import { BookingStatus, Prisma, Role, RoomStatus } from "@prisma/client";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { z } from "zod";
import { createToken, hashPassword, requireAdmin, requireAuth, verifyPassword } from "./auth.js";
import { canCancel, canCheckIn, DomainError, endFor, validateBookingDate, validateNotPast, validateSlot } from "./domain/booking-policy.js";
import { prisma } from "./db.js";

const asyncRoute = (handler: express.RequestHandler): express.RequestHandler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const bookingStates = [BookingStatus.BOOKED, BookingStatus.CHECKED_IN];
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo YYYY-MM-DD");

async function audit(actorId: string, action: string, entity: string, entityId: string, metadata?: unknown) {
  await prisma.auditLog.create({ data: { actorId, action, entity, entityId, metadata: metadata ? JSON.stringify(metadata) : null } });
}

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: true }));
  app.use(express.json());
  app.use(morgan("tiny"));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.post("/auth/register", asyncRoute(async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2).max(80), email: z.string().email(), password: z.string().min(8).max(72) }).parse(req.body);
    const user = await prisma.user.create({ data: { name: input.name, email: input.email.toLowerCase(), passwordHash: await hashPassword(input.password) } });
    const token = createToken(user);
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }));

  app.post("/auth/login", asyncRoute(async (req, res) => {
    const input = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Email hoặc mật khẩu không chính xác." });
    res.json({ token: createToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }));

  app.get("/auth/me", requireAuth, asyncRoute(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
    res.json(user);
  }));

  app.patch("/auth/me", requireAuth, asyncRoute(async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2).max(80), email: z.string().email() }).parse(req.body);
    const user = await prisma.user.update({ where: { id: req.user!.id }, data: { name: input.name, email: input.email.toLowerCase() }, select: { id: true, name: true, email: true, role: true } });
    await audit(req.user!.id, "PROFILE_UPDATED", "User", user.id, { name: user.name, email: user.email });
    res.json(user);
  }));

  app.get("/rooms", asyncRoute(async (req, res) => {
    const minCapacity = req.query.minCapacity ? Number(req.query.minCapacity) : undefined;
    const equipment = typeof req.query.equipment === "string" ? req.query.equipment.split(",").filter(Boolean) : [];
    const rooms = await prisma.room.findMany({
      where: { status: RoomStatus.ACTIVE, ...(Number.isFinite(minCapacity) ? { capacity: { gte: minCapacity } } : {}), ...(equipment.length ? { equipment: { every: { equipment: { name: { in: equipment } } } } } : {}) },
      include: { equipment: { include: { equipment: true } } }, orderBy: { name: "asc" }
    });
    res.json(rooms);
  }));

  app.get("/rooms/availability", asyncRoute(async (req, res) => {
    const date = dateSchema.parse(req.query.date);
    const rooms = await prisma.room.findMany({ where: { status: RoomStatus.ACTIVE }, include: { closures: { where: { date } }, bookings: { where: { date, status: { in: bookingStates } } }, equipment: { include: { equipment: true } } }, orderBy: { name: "asc" } });
    res.json(rooms.map((room) => ({
      ...room,
      available: room.closures.length === 0,
      occupiedSlots: room.bookings.map((booking) => booking.startTime)
    })));
  }));

  app.post("/bookings", requireAuth, asyncRoute(async (req, res) => {
    const input = z.object({ roomId: z.string().min(1), date: dateSchema, startTime: z.string() }).parse(req.body);
    validateSlot(input.startTime); validateBookingDate(input.date); validateNotPast(input.date, input.startTime);
    const booking = await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: input.roomId }, include: { closures: { where: { date: input.date } } } });
      if (!room || room.status !== RoomStatus.ACTIVE) throw new DomainError("ROOM_UNAVAILABLE", "Phòng không khả dụng.");
      if (room.closures.length) throw new DomainError("ROOM_CLOSED", "Phòng đóng vào ngày đã chọn.");
      const sameStudent = await tx.booking.findFirst({ where: { userId: req.user!.id, date: input.date, startTime: input.startTime, status: { in: bookingStates } } });
      if (sameStudent) throw new DomainError("STUDENT_CONFLICT", "Bạn đã có lịch đặt trong khung giờ này.");
      return tx.booking.create({ data: { userId: req.user!.id, roomId: input.roomId, date: input.date, startTime: input.startTime, endTime: endFor(input.startTime) }, include: { room: true } });
    });
    await audit(req.user!.id, "BOOKING_CREATED", "Booking", booking.id, { roomId: booking.roomId, date: booking.date, startTime: booking.startTime });
    res.status(201).json(booking);
  }));

  app.get("/bookings/me", requireAuth, asyncRoute(async (req, res) => {
    res.json(await prisma.booking.findMany({ where: { userId: req.user!.id }, include: { room: true }, orderBy: [{ date: "asc" }, { startTime: "asc" }] }));
  }));

  app.patch("/bookings/:id/cancel", requireAuth, asyncRoute(async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { id: String(req.params.id) } });
    if (!booking) return res.status(404).json({ error: "BOOKING_NOT_FOUND", message: "Không tìm thấy lịch đặt." });
    if (booking.userId !== req.user!.id) return res.status(403).json({ error: "BOOKING_OWNER_ONLY", message: "Bạn chỉ được hủy lịch của mình." });
    if (booking.status !== BookingStatus.BOOKED || !canCancel(booking.date, booking.startTime)) return res.status(422).json({ error: "CANCELLATION_NOT_ALLOWED", message: "Lịch chỉ được hủy trước giờ bắt đầu ít nhất 60 phút." });
    const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CANCELLED, cancelledAt: new Date() } });
    await audit(req.user!.id, "BOOKING_CANCELLED", "Booking", booking.id);
    res.json(updated);
  }));

  app.patch("/bookings/:id/check-in", requireAuth, asyncRoute(async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { id: String(req.params.id) } });
    if (!booking) return res.status(404).json({ error: "BOOKING_NOT_FOUND", message: "Không tìm thấy lịch đặt." });
    if (booking.userId !== req.user!.id) return res.status(403).json({ error: "BOOKING_OWNER_ONLY", message: "Bạn chỉ được check-in lịch của mình." });
    if (booking.status !== BookingStatus.BOOKED || !canCheckIn(booking.date, booking.startTime)) return res.status(422).json({ error: "CHECKIN_NOT_ALLOWED", message: "Chỉ check-in từ 15 phút trước đến 15 phút sau giờ bắt đầu." });
    const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CHECKED_IN } });
    await audit(req.user!.id, "BOOKING_CHECKED_IN", "Booking", booking.id);
    res.json(updated);
  }));

  app.post("/admin/rooms", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2), capacity: z.number().int().min(1).max(500), location: z.string().trim().min(2), equipment: z.array(z.string().trim().min(1)).default([]) }).parse(req.body);
    const room = await prisma.room.create({ data: { name: input.name, capacity: input.capacity, location: input.location, equipment: { create: input.equipment.map((name) => ({ equipment: { connectOrCreate: { where: { name }, create: { name } } } })) } }, include: { equipment: { include: { equipment: true } } } });
    await audit(req.user!.id, "ROOM_CREATED", "Room", room.id);
    res.status(201).json(room);
  }));

  app.patch("/admin/rooms/:id/status", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const input = z.object({ status: z.nativeEnum(RoomStatus) }).parse(req.body);
    const room = await prisma.room.update({ where: { id: String(req.params.id) }, data: { status: input.status } });
    await audit(req.user!.id, "ROOM_STATUS_CHANGED", "Room", room.id, { status: room.status });
    res.json(room);
  }));

  app.post("/admin/rooms/:id/closures", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const input = z.object({ date: dateSchema, reason: z.string().trim().min(3).max(200) }).parse(req.body);
    const closure = await prisma.roomClosure.create({ data: { roomId: String(req.params.id), ...input } });
    await audit(req.user!.id, "ROOM_CLOSED", "RoomClosure", closure.id, input);
    res.status(201).json(closure);
  }));

  app.get("/admin/users", requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: "asc" } }));
  }));

  app.patch("/admin/users/:id/role", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const input = z.object({ role: z.nativeEnum(Role) }).parse(req.body);
    if (String(req.params.id) === req.user!.id && input.role !== Role.ADMIN) throw new DomainError("SELF_ROLE_CHANGE_FORBIDDEN", "Không thể tự gỡ quyền quản trị.");
    const user = await prisma.user.update({ where: { id: String(req.params.id) }, data: input, select: { id: true, name: true, email: true, role: true } });
    await audit(req.user!.id, "USER_ROLE_CHANGED", "User", user.id, { role: user.role });
    res.json(user);
  }));

  app.get("/admin/equipment", requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await prisma.equipment.findMany({ include: { _count: { select: { rooms: true } } }, orderBy: { name: "asc" } }));
  }));

  app.post("/admin/equipment", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2).max(80) }).parse(req.body);
    const equipment = await prisma.equipment.create({ data: input });
    await audit(req.user!.id, "EQUIPMENT_CREATED", "Equipment", equipment.id, input);
    res.status(201).json(equipment);
  }));

  app.delete("/admin/equipment/:id", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const equipment = await prisma.equipment.findUniqueOrThrow({ where: { id: String(req.params.id) }, include: { _count: { select: { rooms: true } } } });
    if (equipment._count.rooms) throw new DomainError("EQUIPMENT_IN_USE", "Không thể xóa thiết bị đang được gán cho phòng.");
    await prisma.equipment.delete({ where: { id: equipment.id } });
    await audit(req.user!.id, "EQUIPMENT_DELETED", "Equipment", equipment.id, { name: equipment.name });
    res.status(204).end();
  }));

  app.get("/admin/rooms", requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await prisma.room.findMany({ include: { equipment: { include: { equipment: true } }, closures: true, _count: { select: { bookings: true } } }, orderBy: { name: "asc" } }));
  }));

  app.patch("/admin/rooms/:id", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2).optional(), capacity: z.number().int().min(1).max(500).optional(), location: z.string().trim().min(2).optional(), status: z.nativeEnum(RoomStatus).optional() }).refine((value) => Object.keys(value).length > 0, "Cần ít nhất một trường để cập nhật.").parse(req.body);
    const room = await prisma.room.update({ where: { id: String(req.params.id) }, data: input });
    await audit(req.user!.id, "ROOM_UPDATED", "Room", room.id, input);
    res.json(room);
  }));

  app.patch("/admin/rooms/:id/equipment", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const input = z.object({ equipmentIds: z.array(z.string().min(1)).max(50).default([]) }).parse(req.body);
    const roomId = String(req.params.id);
    const room = await prisma.$transaction(async (tx) => {
      await tx.room.findUniqueOrThrow({ where: { id: roomId } });
      await tx.equipment.findMany({ where: { id: { in: input.equipmentIds } }, select: { id: true } }).then((items) => {
        if (items.length !== new Set(input.equipmentIds).size) throw new DomainError("EQUIPMENT_NOT_FOUND", "Thiết bị không tồn tại.");
      });
      await tx.roomEquipment.deleteMany({ where: { roomId } });
      if (input.equipmentIds.length) await tx.roomEquipment.createMany({ data: [...new Set(input.equipmentIds)].map((equipmentId) => ({ roomId, equipmentId })) });
      return tx.room.findUniqueOrThrow({ where: { id: roomId }, include: { equipment: { include: { equipment: true } } } });
    });
    await audit(req.user!.id, "ROOM_EQUIPMENT_UPDATED", "Room", room.id, { equipmentIds: input.equipmentIds });
    res.json(room);
  }));

  app.get("/admin/rooms/:id/closures", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    res.json(await prisma.roomClosure.findMany({ where: { roomId: String(req.params.id) }, orderBy: { date: "asc" } }));
  }));

  app.delete("/admin/closures/:id", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const closure = await prisma.roomClosure.delete({ where: { id: String(req.params.id) } });
    await audit(req.user!.id, "ROOM_CLOSURE_DELETED", "RoomClosure", closure.id, { roomId: closure.roomId, date: closure.date });
    res.status(204).end();
  }));
  app.get("/admin/bookings", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const date = req.query.date ? dateSchema.parse(req.query.date) : undefined;
    res.json(await prisma.booking.findMany({ where: date ? { date } : undefined, include: { user: { select: { id: true, name: true, email: true } }, room: true }, orderBy: [{ date: "desc" }, { startTime: "asc" }] }));
  }));

  app.patch("/admin/bookings/:id/status", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const input = z.object({ status: z.nativeEnum(BookingStatus) }).parse(req.body);
    const booking = await prisma.booking.update({ where: { id: String(req.params.id) }, data: { status: input.status, ...(input.status === BookingStatus.CANCELLED ? { cancelledAt: new Date() } : {}) }, include: { room: true, user: { select: { id: true, name: true, email: true } } } });
    await audit(req.user!.id, "BOOKING_STATUS_CHANGED", "Booking", booking.id, { status: booking.status });
    res.json(booking);
  }));

  app.get("/admin/reports/usage", requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
    const bookings = await prisma.booking.findMany({ where: { status: { in: [BookingStatus.BOOKED, BookingStatus.CHECKED_IN, BookingStatus.NO_SHOW] } }, include: { room: true } });
    const roomCounts = bookings.reduce<Record<string, { roomName: string; bookings: number }>>((acc, booking) => { acc[booking.roomId] ??= { roomName: booking.room.name, bookings: 0 }; acc[booking.roomId].bookings += 1; return acc; }, {});
    const activeRooms = await prisma.room.count({ where: { status: RoomStatus.ACTIVE } });
    res.json({ totals: { bookings: bookings.length, checkedIn: bookings.filter((b) => b.status === BookingStatus.CHECKED_IN).length, noShow: bookings.filter((b) => b.status === BookingStatus.NO_SHOW).length, occupancyRate: activeRooms ? Number((bookings.length / (activeRooms * 14 * 14) * 100).toFixed(2)) : 0 }, rooms: Object.values(roomCounts).sort((a, b) => b.bookings - a.bookings) });
  }));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError) return res.status(422).json({ error: "VALIDATION_ERROR", details: error.flatten() });
    if (error instanceof DomainError) return res.status(422).json({ error: error.code, message: error.message });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "BOOKING_CONFLICT", message: "Phòng đã có lịch trong khung giờ này." });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return res.status(404).json({ error: "NOT_FOUND", message: "Không tìm thấy dữ liệu." });
    console.error(error);
    return res.status(500).json({ error: "INTERNAL_ERROR", message: "Có lỗi hệ thống xảy ra." });
  });
  return app;
}
