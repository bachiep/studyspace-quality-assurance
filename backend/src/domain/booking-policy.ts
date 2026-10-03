export const SLOT_STARTS = Array.from({ length: 14 }, (_, index) => String(index + 7).padStart(2, "0") + ":00");
export const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";
const BUSINESS_UTC_OFFSET_MINUTES = 7 * 60;

export class DomainError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export function endFor(startTime: string): string {
  const hour = Number(startTime.slice(0, 2));
  return String(hour + 1).padStart(2, "0") + ":00";
}

export function validateSlot(startTime: string): void {
  if (!SLOT_STARTS.includes(startTime)) throw new DomainError("INVALID_SLOT", "Khung giờ phải từ 07:00 đến 20:00.");
}

function parseCalendarDate(date: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new DomainError("INVALID_DATE", "Ngày phải tồn tại và theo định dạng YYYY-MM-DD.");
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText); const month = Number(monthText); const day = Number(dayText);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    throw new DomainError("INVALID_DATE", "Ngày phải tồn tại và theo định dạng YYYY-MM-DD.");
  }
  return { year, month, day };
}

function businessDateAt(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function businessDateString(now = new Date()): string {
  const { year, month, day } = businessDateAt(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function calendarOrdinal({ year, month, day }: { year: number; month: number; day: number }): number {
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function businessDateTime(date: string, startTime: string): number {
  const { year, month, day } = parseCalendarDate(date);
  const match = /^(\d{2}):(\d{2})$/.exec(startTime);
  if (!match) throw new DomainError("INVALID_SLOT", "Khung giờ không hợp lệ.");
  return Date.UTC(year, month - 1, day, Number(match[1]), Number(match[2])) - BUSINESS_UTC_OFFSET_MINUTES * 60_000;
}

export function validateBookingDate(date: string, now = new Date()): void {
  const requested = calendarOrdinal(parseCalendarDate(date));
  const today = calendarOrdinal(businessDateAt(now));
  if (requested < today || requested > today + 14) {
    throw new DomainError("INVALID_DATE", "Chỉ được đặt phòng từ hôm nay đến 14 ngày tới.");
  }
}

export function validateNotPast(date: string, startTime: string, now = new Date()): void {
  if (businessDateTime(date, startTime) <= now.getTime()) throw new DomainError("PAST_SLOT", "Không thể đặt khung giờ đã qua.");
}

export function canCancel(date: string, startTime: string, now = new Date()): boolean {
  return businessDateTime(date, startTime) - now.getTime() >= 60 * 60 * 1000;
}

export function canCheckIn(date: string, startTime: string, now = new Date()): boolean {
  const start = businessDateTime(date, startTime);
  const difference = now.getTime() - start;
  return difference >= -15 * 60 * 1000 && difference <= 15 * 60 * 1000;
}
