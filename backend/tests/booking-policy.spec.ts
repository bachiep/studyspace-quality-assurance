import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SLOT_STARTS, canCancel, canCheckIn, DomainError, endFor, validateBookingDate, validateNotPast, validateSlot } from "../src/domain/booking-policy.js";

describe("booking policy", () => {
  const now = new Date("2026-10-01T09:00:00+07:00");
  it("[TC-UNIT-01] accepts configured slots and returns their end time", () => { validateSlot("07:00"); expect(endFor("20:00")).toBe("21:00"); });
  it("[TC-UNIT-02] rejects a slot outside the room schedule", () => expect(() => validateSlot("21:00")).toThrow(DomainError));
  it("[TC-UNIT-03] allows dates from today through day fourteen only", () => {
    expect(() => validateBookingDate("2026-10-01", now)).not.toThrow();
    expect(() => validateBookingDate("2026-10-15", now)).not.toThrow();
    expect(() => validateBookingDate("2026-09-30", now)).toThrow("14 ngày");
    expect(() => validateBookingDate("2026-10-16", now)).toThrow("14 ngày");
  });
  it("[TC-UNIT-06] rejects normalized and malformed calendar dates", () => {
    for (const invalidDate of ["2026-02-29", "2026-02-30", "2026-04-31", "2026-2-01"]) {
      expect(() => validateBookingDate(invalidDate, new Date("2026-02-16T09:00:00+07:00"))).toThrow(DomainError);
    }
    expect(() => validateBookingDate("2028-02-29", new Date("2028-02-16T09:00:00+07:00"))).not.toThrow();
  });
  it("[TC-UNIT-07] uses the Asia/Ho_Chi_Minh calendar day regardless of host timezone", () => {
    const justAfterMidnightInVietnam = new Date("2026-10-01T00:05:00+07:00");
    expect(() => validateBookingDate("2026-10-01", justAfterMidnightInVietnam)).not.toThrow();
    expect(() => validateBookingDate("2026-09-30", justAfterMidnightInVietnam)).toThrow(DomainError);
  });
  it("[TC-UNIT-04] rejects a past slot on the current day", () => expect(() => validateNotPast("2026-10-01", "08:00", now)).toThrow("đã qua"));
  it("[TC-UNIT-05] enforces cancellation at the exact sixty-minute boundary", () => {
    expect(canCancel("2026-10-01", "10:00", new Date("2026-10-01T09:00:00+07:00"))).toBe(true);
    expect(canCancel("2026-10-01", "10:00", new Date("2026-10-01T09:01:00+07:00"))).toBe(false);
  });
  it("[TC-UNIT-08] includes both check-in boundaries and rejects the adjacent minutes", () => {
    expect(canCheckIn("2026-10-01", "09:00", new Date("2026-10-01T08:45:00+07:00"))).toBe(true);
    expect(canCheckIn("2026-10-01", "09:00", new Date("2026-10-01T09:15:00+07:00"))).toBe(true);
    expect(canCheckIn("2026-10-01", "09:00", new Date("2026-10-01T08:44:00+07:00"))).toBe(false);
    expect(canCheckIn("2026-10-01", "09:00", new Date("2026-10-01T09:16:00+07:00"))).toBe(false);
  });

  it("[TC-PBT-01] preserves the one-hour duration invariant for every configured slot", () => {
    fc.assert(fc.property(fc.constantFrom(...SLOT_STARTS), (startTime) => {
      validateSlot(startTime);
      expect(endFor(startTime)).toBe(`${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`);
    }));
  });

  it("[TC-PBT-02] accepts exactly the booking dates from today through day fourteen", () => {
    fc.assert(fc.property(fc.integer({ min: -14, max: 28 }), (offset) => {
      const date = `2026-10-${String(offset + 1).padStart(2, "0")}`;
      if (offset >= 0 && offset <= 14) expect(() => validateBookingDate(date, now)).not.toThrow();
      else expect(() => validateBookingDate(date, now)).toThrow(DomainError);
    }));
  });

  it("[TC-PBT-03] accepts check-in exactly within the minus-fifteen to plus-fifteen-minute window", () => {
    const start = new Date("2026-10-01T09:00:00+07:00");
    fc.assert(fc.property(fc.integer({ min: -60, max: 60 }), (minutesFromStart) => {
      const checkInAt = new Date(start.valueOf() + minutesFromStart * 60_000);
      expect(canCheckIn("2026-10-01", "09:00", checkInAt)).toBe(minutesFromStart >= -15 && minutesFromStart <= 15);
    }));
  });
});
