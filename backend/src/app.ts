import { BookingStatus, Prisma, Role, RoomStatus } from "@prisma/client";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { z } from "zod";
import { createToken, hashPassword, requireAdmin, requireAuth, verifyPassword } from "./auth.js";
import { businessDateString, calendarDaysInclusive, canCancel, canCheckIn, DomainError, endFor, validateBookingDate, validateNotPast, validateSlot } from "./domain/booking-policy.js";
import { prisma } from "./db.js";

const asyncRoute = (handler: express.RequestHandler): express.RequestHandler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const bookingStates = [BookingStatus.BOOKED, BookingStatus.CHECKED_IN];
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo YYYY-MM-DD").refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}, "Ngày không tồn tại.");
const activeSlotKey = (roomId: string, date: string, startTime: string) => `${roomId}:${date}:${startTime}`;
const activeUserSlotKey = (userId: string, date: string, startTime: string) => `${userId}:${date}:${startTime}`;
let bookingWriteTail: Promise<void> = Promise.resolve();

function positiveIntegerSetting(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

function serializeBookingWrite<T>(work: () => Promise<T>) {
  const operation = bookingWriteTail.then(work, work);
  bookingWriteTail = operation.then(() => undefined, () => undefined);
  return operation;
}

async function audit(client: Prisma.TransactionClient | typeof prisma, actorId: string, action: string, entity: string, entityId: string, metadata?: unknown) {
  await client.auditLog.create({ data: { actorId, action, entity, entityId, metadata: metadata ? JSON.stringify(metadata) : null } });
}

export function createApp() {
  const app = express();
  app.use(helmet({
    contentSecurityPolicy: false
  }));
  app.use((_req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; img-src 'self' data:; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self'");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173").split(",").map((origin) => origin.trim()).filter(Boolean);
  const loginLimiter = rateLimit({
    windowMs: positiveIntegerSetting(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, 86_400_000),
    limit: positiveIntegerSetting(process.env.AUTH_RATE_LIMIT_MAX, 5, 100),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (_req, res) => res.status(429).json({ error: "AUTH_RATE_LIMITED", message: "Có quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau." })
  });
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)) }));
  app.use(express.json());
  app.use(morgan("tiny"));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.post("/auth/register", asyncRoute(async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2).max(80), email: z.string().email(), password: z.string().min(8).max(72) }).parse(req.body);
    const user = await prisma.user.create({ data: { name: input.name, email: input.email.toLowerCase(), passwordHash: await hashPassword(input.password) } });
    const token = createToken(user);
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }));

  app.post("/auth/login", loginLimiter, asyncRoute(async (req, res) => {
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
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: req.user!.id }, data: { name: input.name, email: input.email.toLowerCase() }, select: { id: true, name: true, email: true, role: true } });
      await audit(tx, req.user!.id, "PROFILE_UPDATED", "User", updated.id, { name: updated.name, email: updated.email });
      return updated;
    });
    res.json(user);
  }));

  app.get("/rooms", asyncRoute(async (req, res) => {
    const minCapacity = req.query.minCapacity === undefined ? undefined : z.coerce.number().int().min(1).max(500).parse(req.query.minCapacity);
    const equipment = typeof req.query.equipment === "string" ? [...new Set(req.query.equipment.split(",").map((name) => name.trim()).filter(Boolean))] : [];
    const rooms = await prisma.room.findMany({
      where: { status: RoomStatus.ACTIVE, ...(minCapacity === undefined ? {} : { capacity: { gte: minCapacity } }), ...(equipment.length ? { AND: equipment.map((name) => ({ equipment: { some: { equipment: { name } } } })) } : {}) },
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
    const booking = await serializeBookingWrite(() => prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: input.roomId }, include: { closures: { where: { date: input.date } } } });
      if (!room || room.status !== RoomStatus.ACTIVE) throw new DomainError("ROOM_UNAVAILABLE", "Phòng không khả dụng.");
      if (room.closures.length) throw new DomainError("ROOM_CLOSED", "Phòng đóng vào ngày đã chọn.");
      const booking = await tx.booking.create({ data: { userId: req.user!.id, roomId: input.roomId, date: input.date, startTime: input.startTime, endTime: endFor(input.startTime), activeSlotKey: activeSlotKey(input.roomId, input.date, input.startTime), activeUserSlotKey: activeUserSlotKey(req.user!.id, input.date, input.startTime) }, include: { room: true } });
      await audit(tx, req.user!.id, "BOOKING_CREATED", "Booking", booking.id, { roomId: booking.roomId, date: booking.date, startTime: booking.startTime });
      return booking;
    }));
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
    const updated = await serializeBookingWrite(() => prisma.$transaction(async (tx) => {
      const cancelled = await tx.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CANCELLED, cancelledAt: new Date(), activeSlotKey: null, activeUserSlotKey: null } });
      await audit(tx, req.user!.id, "BOOKING_CANCELLED", "Booking", booking.id);
      return cancelled;
    }));
    res.json(updated);
  }));

  app.patch("/bookings/:id/check-in", requireAuth, asyncRoute(async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { id: String(req.params.id) } });
    if (!booking) return res.status(404).json({ error: "BOOKING_NOT_FOUND", message: "Không tìm thấy lịch đặt." });
    if (booking.userId !== req.user!.id) return res.status(403).json({ error: "BOOKING_OWNER_ONLY", message: "Bạn chỉ được check-in lịch của mình." });
    if (booking.status !== BookingStatus.BOOKED || !canCheckIn(booking.date, booking.startTime)) return res.status(422).json({ error: "CHECKIN_NOT_ALLOWED", message: "Chỉ check-in từ 15 phút trước đến 15 phút sau giờ bắt đầu." });
    const updated = await serializeBookingWrite(() => prisma.$transaction(async (tx) => {
      const checkedIn = await tx.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CHECKED_IN } });
      await audit(tx, req.user!.id, "BOOKING_CHECKED_IN", "Booking", booking.id);
      return checkedIn;
    }));
    res.json(updated);
  }));

  app.post("/admin/rooms", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2), capacity: z.number().int().min(1).max(500), location: z.string().trim().min(2), equipment: z.array(z.string().trim().min(1)).default([]) }).parse(req.body);
    const room = await prisma.$transaction(async (tx) => {
      const created = await tx.room.create({ data: { name: input.name, capacity: input.capacity, location: input.location, equipment: { create: input.equipment.map((name) => ({ equipment: { connectOrCreate: { where: { name }, create: { name } } } })) } }, include: { equipment: { include: { equipment: true } } } });
      await audit(tx, req.user!.id, "ROOM_CREATED", "Room", created.id);
      return created;
    });
    res.status(201).json(room);
  }));

  app.patch("/admin/rooms/:id/status", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const input = z.object({ status: z.nativeEnum(RoomStatus) }).parse(req.body);
    const room = await prisma.$transaction(async (tx) => {
      const updated = await tx.room.update({ where: { id: String(req.params.id) }, data: { status: input.status } });
      await audit(tx, req.user!.id, "ROOM_STATUS_CHANGED", "Room", updated.id, { status: updated.status });
      return updated;
    });
    res.json(room);
  }));

  app.post("/admin/rooms/:id/closures", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const input = z.object({ date: dateSchema, reason: z.string().trim().min(3).max(200) }).parse(req.body);
    const roomId = String(req.params.id);
    const closure = await prisma.$transaction(async (tx) => {
      await tx.room.findUniqueOrThrow({ where: { id: roomId }, select: { id: true } });
      const created = await tx.roomClosure.create({ data: { roomId, ...input } });
      await audit(tx, req.user!.id, "ROOM_CLOSED", "RoomClosure", created.id, input);
      return created;
    });
    res.status(201).json(closure);
  }));

  app.get("/admin/users", requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: "asc" } }));
  }));

  app.patch("/admin/users/:id/role", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const input = z.object({ role: z.nativeEnum(Role) }).parse(req.body);
    if (String(req.params.id) === req.user!.id && input.role !== Role.ADMIN) throw new DomainError("SELF_ROLE_CHANGE_FORBIDDEN", "Không thể tự gỡ quyền quản trị.");
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: String(req.params.id) }, data: input, select: { id: true, name: true, email: true, role: true } });
      await audit(tx, req.user!.id, "USER_ROLE_CHANGED", "User", updated.id, { role: updated.role });
      return updated;
    });
    res.json(user);
  }));

  app.get("/admin/equipment", requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await prisma.equipment.findMany({ include: { _count: { select: { rooms: true } } }, orderBy: { name: "asc" } }));
  }));

  app.post("/admin/equipment", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2).max(80) }).parse(req.body);
    const equipment = await prisma.$transaction(async (tx) => {
      const created = await tx.equipment.create({ data: input });
      await audit(tx, req.user!.id, "EQUIPMENT_CREATED", "Equipment", created.id, input);
      return created;
    });
    res.status(201).json(equipment);
  }));

  app.delete("/admin/equipment/:id", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    await prisma.$transaction(async (tx) => {
      const equipment = await tx.equipment.findUniqueOrThrow({ where: { id: String(req.params.id) }, include: { _count: { select: { rooms: true } } } });
      if (equipment._count.rooms) throw new DomainError("EQUIPMENT_IN_USE", "Không thể xóa thiết bị đang được gán cho phòng.");
      await tx.equipment.delete({ where: { id: equipment.id } });
      await audit(tx, req.user!.id, "EQUIPMENT_DELETED", "Equipment", equipment.id, { name: equipment.name });
    });
    res.status(204).end();
  }));

  app.get("/admin/rooms", requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await prisma.room.findMany({ include: { equipment: { include: { equipment: true } }, closures: true, _count: { select: { bookings: true } } }, orderBy: { name: "asc" } }));
  }));

  app.patch("/admin/rooms/:id", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2).optional(), capacity: z.number().int().min(1).max(500).optional(), location: z.string().trim().min(2).optional(), status: z.nativeEnum(RoomStatus).optional() }).refine((value) => Object.keys(value).length > 0, "Cần ít nhất một trường để cập nhật.").parse(req.body);
    const room = await prisma.$transaction(async (tx) => {
      const updated = await tx.room.update({ where: { id: String(req.params.id) }, data: input });
      await audit(tx, req.user!.id, "ROOM_UPDATED", "Room", updated.id, input);
      return updated;
    });
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
      const updated = await tx.room.findUniqueOrThrow({ where: { id: roomId }, include: { equipment: { include: { equipment: true } } } });
      await audit(tx, req.user!.id, "ROOM_EQUIPMENT_UPDATED", "Room", updated.id, { equipmentIds: input.equipmentIds });
      return updated;
    });
    res.json(room);
  }));

  app.get("/admin/rooms/:id/closures", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    res.json(await prisma.roomClosure.findMany({ where: { roomId: String(req.params.id) }, orderBy: { date: "asc" } }));
  }));

  app.delete("/admin/closures/:id", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    await prisma.$transaction(async (tx) => {
      const closure = await tx.roomClosure.delete({ where: { id: String(req.params.id) } });
      await audit(tx, req.user!.id, "ROOM_CLOSURE_DELETED", "RoomClosure", closure.id, { roomId: closure.roomId, date: closure.date });
    });
    res.status(204).end();
  }));
  app.get("/admin/bookings", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const date = req.query.date ? dateSchema.parse(req.query.date) : undefined;
    res.json(await prisma.booking.findMany({ where: date ? { date } : undefined, include: { user: { select: { id: true, name: true, email: true } }, room: true }, orderBy: [{ date: "desc" }, { startTime: "asc" }] }));
  }));

  app.patch("/admin/bookings/:id/status", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const input = z.object({ status: z.nativeEnum(BookingStatus) }).parse(req.body);
    const current = await prisma.booking.findUniqueOrThrow({ where: { id: String(req.params.id) } });
    const allowedTargetStatuses = new Set<BookingStatus>([BookingStatus.CANCELLED, BookingStatus.CHECKED_IN, BookingStatus.NO_SHOW]);
    if (current.status !== BookingStatus.BOOKED || !allowedTargetStatuses.has(input.status)) {
      throw new DomainError("INVALID_BOOKING_TRANSITION", "Chỉ booking BOOKED mới được chuyển sang CANCELLED, CHECKED_IN hoặc NO_SHOW.");
    }
    const isActive = input.status === BookingStatus.CHECKED_IN;
    const booking = await serializeBookingWrite(() => prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({ where: { id: current.id }, data: { status: input.status, ...(input.status === BookingStatus.CANCELLED ? { cancelledAt: new Date() } : {}), ...(isActive ? {} : { activeSlotKey: null, activeUserSlotKey: null }) }, include: { room: true, user: { select: { id: true, name: true, email: true } } } });
      await audit(tx, req.user!.id, "BOOKING_STATUS_CHANGED", "Booking", updated.id, { status: updated.status });
      return updated;
    }));
    res.json(booking);
  }));

  app.get("/admin/reports/usage", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
    const defaultFrom = businessDateString();
    const defaultToDate = new Date(`${defaultFrom}T00:00:00Z`); defaultToDate.setUTCDate(defaultToDate.getUTCDate() + 14);
    const defaultTo = defaultToDate.toISOString().slice(0, 10);
    const from = dateSchema.parse(req.query.from ?? defaultFrom);
    const to = dateSchema.parse(req.query.to ?? defaultTo);
    if (from > to) throw new DomainError("INVALID_REPORT_RANGE", "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
    const activeRooms = await prisma.room.findMany({ where: { status: RoomStatus.ACTIVE }, include: { closures: { where: { date: { gte: from, lte: to } } } } });
    const bookings = await prisma.booking.findMany({ where: { date: { gte: from, lte: to }, status: { in: [BookingStatus.BOOKED, BookingStatus.CHECKED_IN, BookingStatus.NO_SHOW] }, room: { status: RoomStatus.ACTIVE } }, include: { room: true } });
    const roomCounts = bookings.reduce<Record<string, { roomName: string; bookings: number }>>((acc, booking) => { acc[booking.roomId] ??= { roomName: booking.room.name, bookings: 0 }; acc[booking.roomId].bookings += 1; return acc; }, {});
    const days = calendarDaysInclusive(from, to);
    const availableSlots = activeRooms.reduce((total, room) => total + (days - room.closures.length) * 14, 0);
    const checkedIn = bookings.filter((booking) => booking.status === BookingStatus.CHECKED_IN).length;
    const reservationRate = availableSlots ? Number(Math.min(100, bookings.length / availableSlots * 100).toFixed(2)) : 0;
    const utilizationRate = availableSlots ? Number(Math.min(100, checkedIn / availableSlots * 100).toFixed(2)) : 0;
    res.json({ range: { from, to }, totals: { bookings: bookings.length, checkedIn, noShow: bookings.filter((b) => b.status === BookingStatus.NO_SHOW).length, reservationRate, utilizationRate, occupancyRate: reservationRate }, rooms: Object.values(roomCounts).sort((a, b) => b.bookings - a.bookings) });
  }));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError) return res.status(422).json({ error: "VALIDATION_ERROR", details: error.flatten() });
    if (error instanceof DomainError) return res.status(422).json({ error: error.code, message: error.message });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : String(error.meta?.target || "");
      if (target.includes("activeUserSlotKey")) return res.status(409).json({ error: "STUDENT_CONFLICT", message: "Bạn đã có lịch đặt trong khung giờ này." });
      if (target.includes("activeSlotKey")) return res.status(409).json({ error: "BOOKING_CONFLICT", message: "Phòng đã có lịch trong khung giờ này." });
      if (target.includes("email")) return res.status(409).json({ error: "EMAIL_EXISTS", message: "Email đã được sử dụng." });
      return res.status(409).json({ error: "DUPLICATE_RESOURCE", message: "Dữ liệu trùng với bản ghi đã có." });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return res.status(404).json({ error: "NOT_FOUND", message: "Không tìm thấy dữ liệu." });
    console.error(error);
    return res.status(500).json({ error: "INTERNAL_ERROR", message: "Có lỗi hệ thống xảy ra." });
  });
  return app;
}
