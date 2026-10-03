import http from "k6/http";
import { check, sleep } from "k6";

export const options = { vus: 20, duration: "2m", thresholds: { checks: ["rate==1"], http_req_failed: ["rate<0.01"], http_req_duration: ["p(95)<500"] } };
export const testCaseId = "TC-NF-01";
export default function () {
  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const response = http.get(`${__ENV.BASE_URL || "http://localhost:4000"}/rooms/availability?date=${date}`);
  check(response, { "availability returns 200": (result) => result.status === 200, "response is JSON": (result) => result.headers["Content-Type"]?.includes("application/json") });
  sleep(1);
}
