import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SLOT_STARTS, canCancel, canCheckIn, DomainError, endFor, validateBookingDate, validateNotPast, validateSlot } from "../src/domain/booking-policy.js";

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

  it("preserves the one-hour duration invariant for every configured slot", () => {
    fc.assert(fc.property(fc.constantFrom(...SLOT_STARTS), (startTime) => {
      validateSlot(startTime);
      expect(endFor(startTime)).toBe(`${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`);
    }));
  });

  it("accepts exactly the booking dates from today through day fourteen", () => {
    fc.assert(fc.property(fc.integer({ min: -14, max: 28 }), (offset) => {
      const date = `2026-10-${String(offset + 1).padStart(2, "0")}`;
      if (offset >= 0 && offset <= 14) expect(() => validateBookingDate(date, now)).not.toThrow();
      else expect(() => validateBookingDate(date, now)).toThrow(DomainError);
    }));
  });

  it("accepts check-in exactly within the minus-fifteen to plus-fifteen-minute window", () => {
    const start = new Date("2026-10-01T09:00:00");
    fc.assert(fc.property(fc.integer({ min: -60, max: 60 }), (minutesFromStart) => {
      const checkInAt = new Date(start.valueOf() + minutesFromStart * 60_000);
      expect(canCheckIn("2026-10-01", "09:00", checkInAt)).toBe(minutesFromStart >= -15 && minutesFromStart <= 15);
    }));
  });
});
