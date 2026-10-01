# Test Summary Report

## Phạm vi và kết quả

| Hoạt động | Kết quả | Evidence |
|---|---:|---|
| Unit + API (Vitest) | 38/38 pass (5 unit, 33 API/configuration) | `backend/tests`, `backend/coverage` |
| Coverage V8 | 94.89% line, 89.78% branch, 93.33% function | `backend/coverage` |
| Mutation testing | 52 killed / 11 survived / 5 compile-error mutants; score 82.54% | `reports/generated/stryker/mutation.json` |
| E2E Chromium | 20/20 pass trên Desktop Chrome và Pixel 5 | `reports/generated/playwright` |
| Axe login | 0 vi phạm serious/critical | Playwright report |
| Lighthouse production | Performance 100; Accessibility 100; Best Practices 96; SEO 82 | `reports/generated/lighthouse-production.report.html` |
| k6 availability | 20 VUs/2 phút; 2,382 requests; 19.69 req/s; error 0%; p95 17.47 ms; exit 0 | `reports/generated/k6-final-summary.json` |
| k6 booking race | 20 VUs; 1 response 201, 19 response 409; error 0%; p95 292.09 ms; exit 0 | `docs/evidence/k6-booking-race-summary.json` |
| OWASP ZAP production baseline | 0 High, 0 Medium, 0 Low, 2 Informational | `reports/generated/zap/baseline-production.html` |
| Runtime dependency audit | 0 High/critical vulnerabilities (`--omit=dev --omit=optional`) | CI security step |
| Database migration isolation | Migrations áp thành công từ database test trắng trước unit/API và E2E | Console test, CI quality run |

## Quyết định chất lượng

- Booking concurrent được test cả theo phòng và theo Student: k6 xác minh 20 request cho đúng 1 response 201 và 19 response 409; hai unique active-key, transaction và hàng đợi write SQLite là biện pháp phòng ngừa.
- RBAC đã có test 401/403 và API admin chỉ nhận token ADMIN.
- Token hết hạn bị từ chối, Helmet phát security headers và CORS chỉ cấp cho origin frontend được cấu hình; bằng chứng API nằm trong `backend/tests/api.spec.ts`.
- Phòng có lịch sử được chuyển `INACTIVE`, không xóa dữ liệu nghiệp vụ.
- Axe và Lighthouse production đạt ngưỡng accessibility/best practices đã đặt.
- Luồng E2E chạy tuần tự qua desktop/mobile để cùng database test không tạo xung đột giả giữa các project.
- ZAP production baseline không có alert High/Medium/Low; hai informational alert được giữ nguyên trong report.

## Evidence đã đóng

- Stryker mutation score đã đạt 82.54% (mục tiêu ≥60%).
- OWASP ZAP production baseline đã chạy, không có High/Medium/Low.

Hai mục được ghi nhận từ report thực tế, không suy diễn từ các test khác.
