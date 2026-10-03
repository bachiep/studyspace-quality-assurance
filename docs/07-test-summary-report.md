# Test Summary Report

## Phạm vi và kết quả

| Hoạt động | Kết quả | Evidence |
|---|---:|---|
| Unit + property-based + API (Vitest) | 47/47 pass (11 domain/property-based, 36 API/configuration) | `backend/tests`, CI quality run |
| Coverage V8 | 98.27% line, 93.92% branch, 100% function | `backend/coverage/coverage-summary.json` |
| Mutation testing | 88 killed / 16 survived / 2 no-coverage / 26 compile-error; score 84,62% (`killed / (killed + survived)`) | `reports/generated/stryker/mutation.json`, CI mutation step |
| E2E Chromium | 24/24 pass trên Desktop Chrome và Pixel 5; 12 scenario | `tests/e2e/studyspace.spec.ts`, Playwright artifact |
| Axe login/student/admin | 0 vi phạm serious/critical trong ba trang | `tests/e2e/studyspace.spec.ts`, CI E2E step |
| Lighthouse production preview | Performance 100; Accessibility 100; Best Practices 96 | `reports/generated/lighthouse/report.json` |
| k6 availability | 20 VUs/2 phút; 2,390 requests; checks 100%; error 0%; p95 15.98 ms | `reports/generated/k6/availability-summary.json` |
| k6 booking race | 20 VUs; 1 response 201, 19 response 409; checks 100%; error 0%; p95 370.25 ms | `reports/generated/k6/booking-race-summary.json` (JWT sanitized) |
| OWASP ZAP baseline | Chưa chạy local; không kết luận Pass | `quality-evidence.yml` sẽ tạo artifact release |
| Runtime dependency audit | 0 High/critical vulnerabilities (`--omit=dev --omit=optional`) | CI security step |
| Fresh-clone bootstrap | Evidence cũ gắn `8a516df`; cần chạy lại trên final SHA | `docs/evidence/fresh-clone-verification.json` |
| Database migration isolation | Migrations áp thành công từ database test trắng trước unit/API và E2E | `docs/evidence/bootstrap-summary.json`, CI quality run |

## Quyết định chất lượng

- Booking concurrent được test cả theo phòng và theo Student: k6 xác minh 20 request cho đúng 1 response 201 và 19 response 409; hai unique active-key, transaction và hàng đợi write SQLite là biện pháp phòng ngừa.
- RBAC đã có test 401/403 và API admin chỉ nhận token ADMIN.
- Token hết hạn bị từ chối, Helmet phát security headers và CORS chỉ cấp cho origin frontend được cấu hình; bằng chứng API nằm trong `backend/tests/api.spec.ts`.
- Login không thành công bị giới hạn theo client; ngưỡng/cửa sổ cấu hình qua môi trường và vượt ngưỡng trả `429` `AUTH_RATE_LIMITED`.
- Phòng có lịch sử được chuyển `INACTIVE`, không xóa dữ liệu nghiệp vụ.
- Axe và Lighthouse production preview đạt ngưỡng accessibility/best practices đã đặt; Performance đạt 100 trong lần chạy này.
- Luồng E2E chạy tuần tự qua desktop/mobile để cùng database test không tạo xung đột giả giữa các project.
- ZAP chưa có artifact trên local final candidate; không được diễn giải là đã pass.

## Evidence đã đóng

- Stryker mutation score local hiện đạt 84,62% theo công thức `killed / (killed + survived)` (mục tiêu ≥60%); no-coverage và compile-error được báo cáo riêng.
- OWASP ZAP là mục bắt buộc của release workflow và vẫn đang chờ artifact final.

Hai mục được ghi nhận từ report thực tế, không suy diễn từ các test khác.
