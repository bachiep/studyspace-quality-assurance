export const SLOT_STARTS = Array.from({ length: 14 }, (_, index) => String(index + 7).padStart(2, "0") + ":00");

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

export function validateBookingDate(date: string, now = new Date()): void {
  const requested = new Date(`${date}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const max = new Date(today);
  max.setDate(max.getDate() + 14);
  if (Number.isNaN(requested.valueOf()) || requested < today || requested > max) {
    throw new DomainError("INVALID_DATE", "Chỉ được đặt phòng từ hôm nay đến 14 ngày tới.");
  }
}

export function validateNotPast(date: string, startTime: string, now = new Date()): void {
  if (new Date(`${date}T${startTime}:00`) <= now) throw new DomainError("PAST_SLOT", "Không thể đặt khung giờ đã qua.");
}

export function canCancel(date: string, startTime: string, now = new Date()): boolean {
  return new Date(`${date}T${startTime}:00`).getTime() - now.getTime() >= 60 * 60 * 1000;
}

export function canCheckIn(date: string, startTime: string, now = new Date()): boolean {
  const start = new Date(`${date}T${startTime}:00`).getTime();
  const difference = now.getTime() - start;
  return difference >= -15 * 60 * 1000 && difference <= 15 * 60 * 1000;
}
