# Test Summary Report

## Phạm vi và kết quả

| Hoạt động | Kết quả | Evidence |
|---|---:|---|
| Unit + API (Vitest) | 25/25 pass | `backend/tests`, `backend/coverage` |
| Coverage V8 | 96.55% line, 75.86% branch, 100% function | `backend/coverage` |
| E2E Chromium | 9/9 pass | `reports/generated/playwright` |
| Axe login | 0 vi phạm serious/critical | Playwright report |
| Lighthouse production | Performance 100; Accessibility 100; Best Practices 96; SEO 82 | `reports/generated/lighthouse-production.report.html` |
| k6 availability | 20 VUs/2 phút; 2,400 request; 19.92 req/s; error 0%; p95 4.53 ms | `reports/generated/k6-final-summary.json` |

## Quyết định chất lượng

- Booking concurrent được test: một request 201, request còn lại 409; SQLite unique constraint và transaction là biện pháp phòng ngừa.
- RBAC đã có test 401/403 và API admin chỉ nhận token ADMIN.
- Token hết hạn bị từ chối và Helmet phát security headers; bằng chứng API nằm trong `backend/tests/api.spec.ts`.
- Phòng có lịch sử được chuyển `INACTIVE`, không xóa dữ liệu nghiệp vụ.
- Axe và Lighthouse production đạt ngưỡng accessibility/best practices đã đặt.

## Mục còn cần chạy trước khi đóng hồ sơ

- Stryker mutation report cho `booking-policy.ts` (mục tiêu >=60%).
- OWASP ZAP baseline report; chỉ đóng khi không còn finding High.

Hai mục này được ghi nhận minh bạch là pending, không suy diễn từ các test khác.
