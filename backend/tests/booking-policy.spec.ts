import { describe, expect, it } from "vitest";
import { canCancel, canCheckIn, DomainError, endFor, validateBookingDate, validateNotPast, validateSlot } from "../src/domain/booking-policy.js";

describe("booking policy", () => {
  const now = new Date("2026-10-01T09:00:00");
  it("accepts configured slots and returns their end time", () => { validateSlot("07:00"); expect(endFor("20:00")).toBe("21:00"); });
  it("rejects a slot outside the room schedule", () => expect(() => validateSlot("21:00")).toThrow(DomainError));
  it("allows dates in the next fourteen days only", () => { expect(() => validateBookingDate("2026-10-15", now)).not.toThrow(); expect(() => validateBookingDate("2026-10-16", now)).toThrow("14 ngày"); });
  it("rejects a past slot on the current day", () => expect(() => validateNotPast("2026-10-01", "08:00", now)).toThrow("đã qua"));
  it("enforces cancel and check-in time windows", () => {
    expect(canCancel("2026-10-01", "10:00", now)).toBe(true);
    expect(canCancel("2026-10-01", "09:30", now)).toBe(false);
    expect(canCheckIn("2026-10-01", "09:00", new Date("2026-10-01T08:50:00"))).toBe(true);
    expect(canCheckIn("2026-10-01", "09:00", new Date("2026-10-01T09:16:00"))).toBe(false);
  });
});
