# Test Plan

## Mục tiêu

Xác minh StudySpace đáp ứng SRS, đặc biệt tại các điểm rủi ro: xung đột booking, RBAC, thời gian, audit trail và báo cáo aggregate.

## Chiến lược

| Tầng | Kỹ thuật/công cụ | Exit criteria |
|---|---|---|
| Unit | Vitest, V8 coverage, Stryker | Domain policy ≥85% line, ≥70% branch; mutation ≥60% |
| API | Supertest + SQLite test database | Mỗi endpoint có một ca dương và âm |
| E2E | Playwright | 7 luồng student/admin ổn định trên Chromium |
| Security | ZAP baseline + checklist | Không còn finding High |
| Performance | k6 | 20 VUs/2 phút, error rate <1%, lưu p95 |
| Usability | Lighthouse + axe | A11y ≥90, Best Practices ≥90, Performance desktop ≥80 |

## Rủi ro và giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Race condition | DB unique constraint + transaction + concurrent API test |
| Bypass admin | Middleware JWT/RBAC; kiểm thử 401/403 cho toàn bộ endpoint admin |
| Lệch thời gian | Date/slot policy là pure function và unit test tại biên |
| Sai báo cáo | Test booking status riêng, aggregate chỉ dùng status nghiệp vụ hợp lệ |
| Mất lịch sử | Không xóa room có lịch sử; dùng status `INACTIVE` |

## Defect workflow

New → Triaged → In Progress → Ready for retest → Verified → Closed. Mọi bug có expected/actual result, môi trường, severity, ảnh/log và ID test case.

## Baseline đã xác minh

- Vitest: 25/25 pass.
- `src/domain/booking-policy.ts`: 100% line/branch coverage.
- Tổng coverage backend: 96.55% line, 75.86% branch, 100% function. Ngưỡng CI được cấu hình: line/statements/functions ≥85%, branch ≥70%.
- StrykerJS: 68 mutants, 50 killed, 13 survived, 5 compile-error; mutation score 79.37%, đạt ngưỡng 60%.
- Playwright Chromium: 9/9 pass, gồm luồng student, admin report, RBAC/error UI, đăng ký, chuyển góc nhìn, lịch sử hủy, quản lý thiết bị, cập nhật hồ sơ và axe không có vi phạm serious/critical ở trang đăng nhập.
- Lighthouse production: Performance 100, Accessibility 100, Best Practices 96.
- k6 availability: 20 VUs/2 phút, 2.382 requests, error rate 0%, p95 17.47 ms; CLI exit code 0 and both thresholds passed.
- OWASP ZAP 2.17.0 production preview: 0 High, 0 Medium, 0 Low, 2 Informational.
- Backend TypeScript và frontend Vite production build pass.
