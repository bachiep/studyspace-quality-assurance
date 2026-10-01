import "dotenv/config";
import { Role } from "@prisma/client";
import { hashPassword } from "../src/auth.js";
import { prisma } from "../src/db.js";

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.roomClosure.deleteMany();
  const passwordHash = await hashPassword("StudySpace123!");
  await prisma.user.upsert({ where: { email: "admin@studyspace.local" }, update: {}, create: { name: "StudySpace Admin", email: "admin@studyspace.local", passwordHash, role: Role.ADMIN } });
  await prisma.user.upsert({ where: { email: "student@studyspace.local" }, update: {}, create: { name: "Nguyễn Minh Anh", email: "student@studyspace.local", passwordHash } });
  for (const room of [{ name: "A101", capacity: 8, location: "Tòa A – Tầng 1", equipment: ["Máy chiếu", "Bảng trắng"] }, { name: "B204", capacity: 20, location: "Tòa B – Tầng 2", equipment: ["TV 4K", "Bảng trắng", "Điều hòa"] }, { name: "C301", capacity: 12, location: "Tòa C – Tầng 3", equipment: ["Máy chiếu", "Ổ cắm"] }]) {
    await prisma.room.upsert({ where: { name: room.name }, update: {}, create: { name: room.name, capacity: room.capacity, location: room.location, equipment: { create: room.equipment.map((name) => ({ equipment: { connectOrCreate: { where: { name }, create: { name } } } })) } } });
  }
}
main().finally(() => prisma.$disconnect());
