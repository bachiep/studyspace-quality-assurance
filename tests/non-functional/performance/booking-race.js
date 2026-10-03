import http from "k6/http";
import { check } from "k6";
import { Counter, Rate } from "k6/metrics";

const baseUrl = __ENV.BASE_URL || "http://127.0.0.1:4000";
const created = new Counter("booking_created");
const conflicts = new Counter("booking_conflict");
const expectedOutcome = new Rate("expected_booking_outcome");
const bookingResponse = http.expectedStatuses(201, 409);
export const testCaseId = "TC-NF-02";

export const options = {
  scenarios: {
    simultaneous_booking: {
      executor: "per-vu-iterations",
      vus: 20,
      iterations: 1,
      maxDuration: "30s",
      gracefulStop: "0s"
    }
  },
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate==0"],
    expected_booking_outcome: ["rate==1"],
    booking_created: ["count==1"],
    booking_conflict: ["count==19"]
  }
};

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

export function setup() {
  const login = http.post(`${baseUrl}/auth/login`, JSON.stringify({ email: "student@studyspace.local", password: "StudySpace123!" }), { headers: { "Content-Type": "application/json" } });
  if (!check(login, { "seed student login succeeds": (response) => response.status === 200 })) throw new Error("Unable to authenticate the seeded student.");
  const rooms = http.get(`${baseUrl}/rooms`);
  if (!check(rooms, { "active room exists": (response) => response.status === 200 && response.json().length > 0 })) throw new Error("No active room is available for the race scenario.");
  return { roomId: rooms.json()[0].id, token: login.json().token };
}

export default function (data) {
  const response = http.post(`${baseUrl}/bookings`, JSON.stringify({ roomId: data.roomId, date: tomorrow(), startTime: "20:00" }), { headers: { Authorization: `Bearer ${data.token}`, "Content-Type": "application/json" }, responseCallback: bookingResponse });
  const isExpected = response.status === 201 || response.status === 409;
  expectedOutcome.add(isExpected);
  if (response.status === 201) created.add(1);
  if (response.status === 409) conflicts.add(1);
  check(response, { "exactly one success or expected conflict": () => isExpected });
}
