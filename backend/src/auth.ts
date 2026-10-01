import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";

const developmentSecret = "studyspace-development-secret-change-me";
const secret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET must be configured in production.");
  return developmentSecret;
};

export function assertAuthenticationConfiguration() {
  secret();
}

export function createToken(user: { id: string; email: string; role: Role }) {
  return jwt.sign({ email: user.email, role: user.role }, secret(), { subject: user.id, expiresIn: "8h" });
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "AUTH_REQUIRED", message: "Bạn cần đăng nhập." });
  try {
    const payload = jwt.verify(token, secret()) as jwt.JwtPayload;
    if (!payload.sub || typeof payload.email !== "string" || (payload.role !== Role.ADMIN && payload.role !== Role.STUDENT)) {
      throw new Error("Invalid token payload");
    }
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "INVALID_TOKEN", message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== Role.ADMIN) return res.status(403).json({ error: "ADMIN_ONLY", message: "Chỉ quản trị viên được phép thao tác." });
  next();
}
