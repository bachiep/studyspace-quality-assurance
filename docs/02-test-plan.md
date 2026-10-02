# Test Plan

## Mục tiêu

Xác minh StudySpace đáp ứng SRS, đặc biệt tại các điểm rủi ro: xung đột booking, RBAC, thời gian, audit trail và báo cáo aggregate.

## Chiến lược

| Tầng | Kỹ thuật/công cụ | Exit criteria |
|---|---|---|
| Unit | Vitest, V8 coverage, Stryker | Domain policy ≥85% line, ≥70% branch; mutation ≥60% |
| API | Supertest + SQLite test database | Mỗi endpoint có một ca dương và âm |
| E2E | Playwright | 7 luồng student/admin ổn định trên Chromium |
| Security | ZAP baseline + checklist + API auth abuse control | Không còn finding High; vượt ngưỡng login trả `429` |
| Performance | k6 | 20 VUs/2 phút, error rate <1%, lưu p95 |
| Usability | Lighthouse + axe | A11y ≥90, Best Practices ≥90, Performance desktop ≥80 |

## Rủi ro và giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Race condition | Hai unique active-key + transaction + concurrent API test; SQLite single-instance tuần tự hóa write booking; k6 xác minh 1 success/19 conflict |
| Bypass admin | Middleware JWT/RBAC; kiểm thử 401/403 cho toàn bộ endpoint admin |
| Brute-force đăng nhập | Giới hạn login không thành công theo client, cửa sổ và ngưỡng cấu hình; API test xác minh `429` |
| Lệch thời gian | Date/slot policy là pure function, kiểm tra ngày có thực và unit test tại biên |
| Sai báo cáo | Range xác định, trừ closure khỏi mẫu số và chỉ aggregate status nghiệp vụ hợp lệ |
| Mất lịch sử | Không xóa room có lịch sử; dùng status `INACTIVE` |
| Sai migration/test lẫn dữ liệu local | Reset database test cô lập bằng Prisma migrations trước mỗi suite unit/API và E2E |

## Defect workflow

New → Triaged → In Progress → Ready for retest → Verified → Closed. Mọi bug có expected/actual result, môi trường, severity, ảnh/log và ID test case.

## Baseline đã xác minh

- Vitest: 39/39 pass (5 unit, 34 API/configuration).
- Tổng coverage backend: 95.15% line, 90.27% branch, 94.11% function. Ngưỡng CI được cấu hình: line/statements/functions ≥85%, branch ≥70%; số liệu và lệnh chạy lưu tại `docs/evidence/coverage-summary.json`.
- StrykerJS: 68 mutants, 52 killed, 11 survived, 5 compile-error; mutation score 82.54%, đạt ngưỡng 60%.
- Playwright Chromium: 20/20 pass trên Desktop Chrome và Pixel 5, gồm luồng student, admin report, RBAC/error UI, đăng ký, chuyển góc nhìn, lịch sử hủy, quản lý thiết bị, cập nhật hồ sơ, lọc phòng theo sức chứa/thiết bị và axe không có vi phạm serious/critical ở trang đăng nhập.
- Lighthouse production: Performance 100, Accessibility 100, Best Practices 96.
- k6 availability: 20 VUs/2 phút, 2.382 requests, error rate 0%, p95 17.47 ms; CLI exit code 0 and both thresholds passed.
- k6 booking race: 20 VUs đồng thời, 1 response `201`, 19 response `409`, error rate 0%, p95 292.09 ms; exit code 0.
- OWASP ZAP 2.17.0 production preview: 0 High, 0 Medium, 0 Low, 2 Informational.
- Backend TypeScript và frontend Vite production build pass.
