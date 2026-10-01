import { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createToken, hashPassword } from "../src/auth.js";
import { prisma } from "../src/db.js";

const app = createApp();
let studentToken = "";
let adminToken = "";
let roomId = "";
const futureDate = (() => { const date = new Date(); date.setDate(date.getDate() + 2); return date.toISOString().slice(0, 10); })();

beforeEach(async () => {
  await prisma.auditLog.deleteMany(); await prisma.booking.deleteMany(); await prisma.roomClosure.deleteMany(); await prisma.roomEquipment.deleteMany(); await prisma.equipment.deleteMany(); await prisma.room.deleteMany(); await prisma.user.deleteMany();
  const passwordHash = await hashPassword("Password123!");
  const [student, admin] = await Promise.all([
    prisma.user.create({ data: { name: "Student", email: "student@test.local", passwordHash } }),
    prisma.user.create({ data: { name: "Admin", email: "admin@test.local", passwordHash, role: Role.ADMIN } })
  ]);
  const room = await prisma.room.create({ data: { name: "A101", capacity: 8, location: "A1" } });
  roomId = room.id; studentToken = createToken(student); adminToken = createToken(admin);
});

describe.sequential("StudySpace API", () => {
  it("reports a healthy service through the public health contract", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("only grants CORS access to configured local frontend origins", async () => {
    const allowed = await request(app).get("/health").set("origin", "http://localhost:5173");
    const rejected = await request(app).get("/health").set("origin", "https://untrusted.example");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(rejected.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("requires authentication for booking", async () => {
    const response = await request(app).post("/bookings").send({ roomId, date: futureDate, startTime: "10:00" });
    expect(response.status).toBe(401);
  });

  it("prevents non-admin users from creating rooms", async () => {
    const response = await request(app).post("/admin/rooms").set("authorization", `Bearer ${studentToken}`).send({ name: "B202", capacity: 10, location: "B2" });
    expect(response.status).toBe(403);
  });

  it("creates one booking and records an audit entry", async () => {
    const response = await request(app).post("/bookings").set("authorization", `Bearer ${studentToken}`).send({ roomId, date: futureDate, startTime: "10:00" });
    expect(response.status).toBe(201); expect(response.body.status).toBe("BOOKED");
    expect(await prisma.auditLog.count({ where: { action: "BOOKING_CREATED" } })).toBe(1);
  });

  it("returns conflict when concurrent requests reserve the same room slot", async () => {
    const secondStudent = await prisma.user.create({ data: { name: "Student Two", email: "student2@test.local", passwordHash: await hashPassword("Password123!") } });
    const reserve = (token: string) => request(app).post("/bookings").set("authorization", `Bearer ${token}`).send({ roomId, date: futureDate, startTime: "11:00" });
    const results = await Promise.all([reserve(studentToken), reserve(createToken(secondStudent))]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  });

  it("hides inactive rooms from public availability", async () => {
    await request(app).patch(`/admin/rooms/${roomId}/status`).set("authorization", `Bearer ${adminToken}`).send({ status: "INACTIVE" }).expect(200);
    const response = await request(app).get(`/rooms/availability?date=${futureDate}`);
    expect(response.body).toEqual([]);
  });

  it("blocks a booking when an admin closes the room for that date", async () => {
    await request(app).post(`/admin/rooms/${roomId}/closures`).set("authorization", `Bearer ${adminToken}`).send({ date: futureDate, reason: "Bảo trì máy chiếu" }).expect(201);
    const response = await request(app).post("/bookings").set("authorization", `Bearer ${studentToken}`).send({ roomId, date: futureDate, startTime: "12:00" });
    expect(response.status).toBe(422); expect(response.body.error).toBe("ROOM_CLOSED");
  });

  it("allows an owner to cancel an eligible future booking", async () => {
    const created = await request(app).post("/bookings").set("authorization", `Bearer ${studentToken}`).send({ roomId, date: futureDate, startTime: "13:00" }).expect(201);
    const cancelled = await request(app).patch(`/bookings/${created.body.id}/cancel`).set("authorization", `Bearer ${studentToken}`);
    expect(cancelled.status).toBe(200); expect(cancelled.body.status).toBe("CANCELLED");
    expect(await prisma.auditLog.count({ where: { action: "BOOKING_CANCELLED" } })).toBe(1);
    await request(app).post("/bookings").set("authorization", `Bearer ${studentToken}`).send({ roomId, date: futureDate, startTime: "13:00" }).expect(201);
  });

  it("returns admin usage metrics from real booking data", async () => {
    await request(app).post("/bookings").set("authorization", `Bearer ${studentToken}`).send({ roomId, date: futureDate, startTime: "14:00" }).expect(201);
    const response = await request(app).get(`/admin/reports/usage?from=${futureDate}&to=${futureDate}`).set("authorization", `Bearer ${adminToken}`);
    expect(response.status).toBe(200); expect(response.body.range).toEqual({ from: futureDate, to: futureDate }); expect(response.body.totals).toMatchObject({ bookings: 1, occupancyRate: 7.14 }); expect(response.body.rooms[0]).toMatchObject({ roomName: "A101", bookings: 1 });
  });

  it("registers, logs in and returns the authenticated profile", async () => {
    const registered = await request(app).post("/auth/register").send({ name: "New Student", email: "new@test.local", password: "Password123!" });
    expect(registered.status).toBe(201);
    const loggedIn = await request(app).post("/auth/login").send({ email: "new@test.local", password: "Password123!" });
    expect(loggedIn.status).toBe(200);
    const profile = await request(app).get("/auth/me").set("authorization", `Bearer ${loggedIn.body.token}`);
    expect(profile.body).toMatchObject({ email: "new@test.local", role: "STUDENT" });
  });

  it("validates registration, profile updates and unauthenticated profile access", async () => {
    await request(app).post("/auth/register").send({ name: "A", email: "invalid", password: "short" }).expect(422);
    await request(app).get("/auth/me").expect(401);
    const invalidUpdate = await request(app).patch("/auth/me").set("authorization", `Bearer ${studentToken}`).send({ name: "", email: "not-an-email" });
    expect(invalidUpdate.status).toBe(422);
    expect(invalidUpdate.body.error).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid credentials and invalid booking input", async () => {
    await request(app).post("/auth/login").send({ email: "student@test.local", password: "wrong" }).expect(401);
    const response = await request(app).post("/bookings").set("authorization", `Bearer ${studentToken}`).send({ roomId, date: futureDate, startTime: "10:30" });
    expect(response.status).toBe(422); expect(response.body.error).toBe("INVALID_SLOT");
  });

  it("filters active rooms and lets an admin create a room with equipment", async () => {
    const created = await request(app).post("/admin/rooms").set("authorization", `Bearer ${adminToken}`).send({ name: "B202", capacity: 20, location: "B2", equipment: ["Máy chiếu"] });
    expect(created.status).toBe(201); expect(created.body.equipment[0].equipment.name).toBe("Máy chiếu");
    const response = await request(app).get("/rooms?minCapacity=15&equipment=M%C3%A1y%20chi%E1%BA%BFu");
    expect(response.body).toHaveLength(1); expect(response.body[0].name).toBe("B202");
    const projectorRooms = await request(app).get("/rooms?equipment=M%C3%A1y%20chi%E1%BA%BFu");
    expect(projectorRooms.body.map((room: { name: string }) => room.name)).toEqual(["B202"]);
  });

  it("validates public availability dates and excludes rooms that do not meet capacity", async () => {
    const invalid = await request(app).get("/rooms/availability?date=tomorrow");
    expect(invalid.status).toBe(422);
    expect(invalid.body.error).toBe("VALIDATION_ERROR");
    const rooms = await request(app).get("/rooms?minCapacity=99");
    expect(rooms.status).toBe(200);
    expect(rooms.body).toEqual([]);
    await request(app).get("/rooms?minCapacity=not-a-number").expect(422);
    await request(app).get("/rooms/availability?date=2026-02-31").expect(422);
  });

  it("rejects concurrent bookings by the same student in different rooms", async () => {
    const secondRoom = await prisma.room.create({ data: { name: "B102", capacity: 10, location: "B1" } });
    const reserve = (targetRoomId: string) => request(app).post("/bookings").set("authorization", `Bearer ${studentToken}`).send({ roomId: targetRoomId, date: futureDate, startTime: "10:00" });
    const results = await Promise.all([reserve(roomId), reserve(secondRoom.id)]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(results.find((result) => result.status === 409)?.body.error).toBe("STUDENT_CONFLICT");
  });

  it("protects booking ownership and exposes booking lists to their intended roles", async () => {
    const created = await request(app).post("/bookings").set("authorization", `Bearer ${studentToken}`).send({ roomId, date: futureDate, startTime: "15:00" }).expect(201);
    expect((await request(app).get("/bookings/me").set("authorization", `Bearer ${studentToken}`)).body).toHaveLength(1);
    expect((await request(app).patch(`/bookings/${created.body.id}/cancel`).set("authorization", `Bearer ${adminToken}`)).status).toBe(403);
    expect((await request(app).get(`/admin/bookings?date=${futureDate}`).set("authorization", `Bearer ${adminToken}`)).body).toHaveLength(1);
  });

  it("denies check-in outside its allowed time window", async () => {
    const created = await request(app).post("/bookings").set("authorization", `Bearer ${studentToken}`).send({ roomId, date: futureDate, startTime: "16:00" }).expect(201);
    const response = await request(app).patch(`/bookings/${created.body.id}/check-in`).set("authorization", `Bearer ${studentToken}`);
    expect(response.status).toBe(422); expect(response.body.error).toBe("CHECKIN_NOT_ALLOWED");
  });
  it("returns not-found contracts for booking actions", async () => {
    const cancel = await request(app).patch("/bookings/missing-booking/cancel").set("authorization", `Bearer ${studentToken}`);
    expect(cancel.status).toBe(404);
    expect(cancel.body.error).toBe("BOOKING_NOT_FOUND");
    const checkIn = await request(app).patch("/bookings/missing-booking/check-in").set("authorization", `Bearer ${studentToken}`);
    expect(checkIn.status).toBe(404);
    expect(checkIn.body.error).toBe("BOOKING_NOT_FOUND");
  });
  it("allows admins to list users and change another user role with an audit trail", async () => {
    const users = await request(app).get("/admin/users").set("authorization", `Bearer ${adminToken}`);
    expect(users.status).toBe(200); expect(users.body).toHaveLength(2);
    const student = users.body.find((user: { email: string }) => user.email === "student@test.local");
    const changed = await request(app).patch(`/admin/users/${student.id}/role`).set("authorization", `Bearer ${adminToken}`).send({ role: "ADMIN" });
    expect(changed.body.role).toBe("ADMIN");
    expect(await prisma.auditLog.count({ where: { action: "USER_ROLE_CHANGED" } })).toBe(1);
  });

  it("rejects invalid administrative room, closure and role changes", async () => {
    const invalidStatus = await request(app).patch(`/admin/rooms/${roomId}/status`).set("authorization", `Bearer ${adminToken}`).send({ status: "ARCHIVED" });
    expect(invalidStatus.status).toBe(422);
    const invalidClosure = await request(app).post(`/admin/rooms/${roomId}/closures`).set("authorization", `Bearer ${adminToken}`).send({ date: futureDate, reason: "x" });
    expect(invalidClosure.status).toBe(422);
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@test.local" } });
    const selfDemotion = await request(app).patch(`/admin/users/${admin.id}/role`).set("authorization", `Bearer ${adminToken}`).send({ role: "STUDENT" });
    expect(selfDemotion.status).toBe(422);
    expect(selfDemotion.body.error).toBe("SELF_ROLE_CHANGE_FORBIDDEN");
  });

  it("manages unused equipment and protects equipment attached to a room", async () => {
    const created = await request(app).post("/admin/equipment").set("authorization", `Bearer ${adminToken}`).send({ name: "Loa" }).expect(201);
    expect((await request(app).get("/admin/equipment").set("authorization", `Bearer ${adminToken}`)).body[0].name).toBe("Loa");
    await request(app).delete(`/admin/equipment/${created.body.id}`).set("authorization", `Bearer ${adminToken}`).expect(204);
    const attached = await prisma.equipment.create({ data: { name: "Máy chiếu" } });
    await prisma.roomEquipment.create({ data: { roomId, equipmentId: attached.id } });
    const blocked = await request(app).delete(`/admin/equipment/${attached.id}`).set("authorization", `Bearer ${adminToken}`);
    expect(blocked.status).toBe(422); expect(blocked.body.error).toBe("EQUIPMENT_IN_USE");
  });

  it("lets admins update rooms and manage closure records", async () => {
    const updated = await request(app).patch(`/admin/rooms/${roomId}`).set("authorization", `Bearer ${adminToken}`).send({ capacity: 12, location: "A2" });
    expect(updated.status).toBe(200); expect(updated.body.capacity).toBe(12);
    const rooms = await request(app).get("/admin/rooms").set("authorization", `Bearer ${adminToken}`);
    expect(rooms.body[0]).toMatchObject({ id: roomId, capacity: 12 });
    const closure = await request(app).post(`/admin/rooms/${roomId}/closures`).set("authorization", `Bearer ${adminToken}`).send({ date: futureDate, reason: "Bảo trì" }).expect(201);
    expect((await request(app).get(`/admin/rooms/${roomId}/closures`).set("authorization", `Bearer ${adminToken}`)).body).toHaveLength(1);
    await request(app).delete(`/admin/closures/${closure.body.id}`).set("authorization", `Bearer ${adminToken}`).expect(204);
    expect(await prisma.auditLog.count({ where: { action: "ROOM_CLOSURE_DELETED" } })).toBe(1);
  });

  it("validates room patches, equipment assignment and closure deletion", async () => {
    const emptyPatch = await request(app).patch(`/admin/rooms/${roomId}`).set("authorization", `Bearer ${adminToken}`).send({});
    expect(emptyPatch.status).toBe(422);
    const unknownEquipment = await request(app).patch(`/admin/rooms/${roomId}/equipment`).set("authorization", `Bearer ${adminToken}`).send({ equipmentIds: ["missing-equipment"] });
    expect(unknownEquipment.status).toBe(422);
    expect(unknownEquipment.body.error).toBe("EQUIPMENT_NOT_FOUND");
    const missingClosure = await request(app).delete("/admin/closures/missing-closure").set("authorization", `Bearer ${adminToken}`);
    expect(missingClosure.status).toBe(404);
    expect(missingClosure.body.error).toBe("NOT_FOUND");
  });

  it("allows an authenticated user to update their profile", async () => {
    const response = await request(app).patch("/auth/me").set("authorization", `Bearer ${studentToken}`).send({ name: "Updated Student", email: "updated@test.local" });
    expect(response.status).toBe(200); expect(response.body).toMatchObject({ name: "Updated Student", email: "updated@test.local" });
    expect(await prisma.auditLog.count({ where: { action: "PROFILE_UPDATED" } })).toBe(1);
  });

  it("lets admins assign equipment to a room", async () => {
    const equipment = await prisma.equipment.create({ data: { name: "Bảng trắng" } });
    const response = await request(app).patch(`/admin/rooms/${roomId}/equipment`).set("authorization", `Bearer ${adminToken}`).send({ equipmentIds: [equipment.id] });
    expect(response.status).toBe(200); expect(response.body.equipment[0].equipment.name).toBe("Bảng trắng");
    expect(await prisma.auditLog.count({ where: { action: "ROOM_EQUIPMENT_UPDATED" } })).toBe(1);
  });

  it("lets admins mark a booking as no-show", async () => {
    const created = await request(app).post("/bookings").set("authorization", `Bearer ${studentToken}`).send({ roomId, date: futureDate, startTime: "17:00" }).expect(201);
    const response = await request(app).patch(`/admin/bookings/${created.body.id}/status`).set("authorization", `Bearer ${adminToken}`).send({ status: "NO_SHOW" });
    expect(response.status).toBe(200); expect(response.body.status).toBe("NO_SHOW");
    expect(await prisma.auditLog.count({ where: { action: "BOOKING_STATUS_CHANGED" } })).toBe(1);
    await request(app).patch(`/admin/bookings/${created.body.id}/status`).set("authorization", `Bearer ${adminToken}`).send({ status: "BOOKED" }).expect(422);
    const secondStudent = await prisma.user.create({ data: { name: "Student Two", email: "student2@test.local", passwordHash: await hashPassword("Password123!") } });
    await request(app).post("/bookings").set("authorization", `Bearer ${createToken(secondStudent)}`).send({ roomId, date: futureDate, startTime: "17:00" }).expect(201);
  });

  it("validates administrative booking filters and status changes", async () => {
    const invalidFilter = await request(app).get("/admin/bookings?date=2026/10/01").set("authorization", `Bearer ${adminToken}`);
    expect(invalidFilter.status).toBe(422);
    const created = await request(app).post("/bookings").set("authorization", `Bearer ${studentToken}`).send({ roomId, date: futureDate, startTime: "18:00" }).expect(201);
    const invalidStatus = await request(app).patch(`/admin/bookings/${created.body.id}/status`).set("authorization", `Bearer ${adminToken}`).send({ status: "UNKNOWN" });
    expect(invalidStatus.status).toBe(422);
    expect(invalidStatus.body.error).toBe("VALIDATION_ERROR");
  });

  it("enforces administration authorization for protected read endpoints", async () => {
    const endpoints = ["/admin/users", "/admin/equipment", "/admin/rooms", "/admin/bookings", "/admin/reports/usage"];
    for (const endpoint of endpoints) {
      const response = await request(app).get(endpoint).set("authorization", `Bearer ${studentToken}`);
      expect(response.status).toBe(403);
      expect(response.body.error).toBe("ADMIN_ONLY");
    }
  });

  it("rejects expired tokens and emits baseline security headers", async () => {
    const expired = jwt.sign({ email: "student@test.local", role: Role.STUDENT }, process.env.JWT_SECRET || "studyspace-development-secret-change-me", { subject: "expired-user", expiresIn: -1 });
    const expiredResponse = await request(app).get("/bookings/me").set("authorization", `Bearer ${expired}`);
    expect(expiredResponse.status).toBe(401); expect(expiredResponse.body.error).toBe("INVALID_TOKEN");
    const health = await request(app).get("/health");
    expect(health.headers["x-content-type-options"]).toBe("nosniff");
    expect(health.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });
});
