import "dotenv/config";
import { closeSync, mkdirSync, openSync } from "node:fs";
import { dirname, resolve } from "node:path";

const url = process.env.DATABASE_URL;
if (!url?.startsWith("file:")) throw new Error("DATABASE_URL phải dùng SQLite file: path.");

const filePath = url.slice("file:".length);
if (!filePath || filePath === ":memory:") throw new Error("DATABASE_URL phải trỏ đến SQLite database cục bộ.");

const target = resolve(process.cwd(), "prisma", filePath);
mkdirSync(dirname(target), { recursive: true });
closeSync(openSync(target, "a"));
