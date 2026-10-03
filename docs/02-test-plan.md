# Test Plan

## Mục tiêu

Xác minh StudySpace đáp ứng SRS, đặc biệt tại các điểm rủi ro: xung đột booking, RBAC, thời gian, audit trail và báo cáo aggregate.

## Chiến lược

| Tầng | Kỹ thuật/công cụ | Exit criteria |
|---|---|---|
| Unit | Vitest, V8 coverage, Stryker | Domain policy ≥85% line, ≥70% branch; mutation ≥60% |
| Property-based | fast-check trên domain policy thuần | Kiểm tra bất biến slot, khoảng ngày và cửa sổ check-in với dữ liệu sinh tự động |
| API | Supertest + SQLite test database | Mỗi endpoint có một ca dương và âm |
| E2E | Playwright | 12 scenario student/admin ổn định trên Chromium desktop/mobile |
| Security | ZAP baseline + [checklist](11-security-checklist.md) + API auth abuse control | Không còn finding High; vượt ngưỡng login trả `429` |
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

## Truy vết requirement, kỹ thuật và evidence

| Nhóm requirement | Kỹ thuật chính | Test representative | Evidence |
|---|---|---|---|
| REQ-AUTH-* | API black-box, EP, BVA, security negative, E2E | TC-API-09, TC-API-20, TC-API-22, TC-API-35, TC-E2E-03 | `backend/tests/api.spec.ts`, Playwright report |
| REQ-ROOM-* | API black-box, EP, BVA, E2E | TC-API-06, TC-API-11, TC-API-23, TC-E2E-10 | API test và Playwright report |
| REQ-BOOK-01/04 | BVA, state transition, property-based, API black-box, E2E | TC-UNIT-01..05, TC-PBT-01..03, TC-API-07, TC-API-36, TC-E2E-01 | Domain/API test, coverage và Playwright report |
| REQ-BOOK-02 | Concurrency test, database integrity, performance | TC-API-04, TC-API-29, TC-API-31, TC-NF-02 | API test, k6 race summary |
| REQ-REPORT-* | Decision table, BVA, API black-box, E2E | TC-API-08, TC-API-19, TC-API-32, TC-E2E-02 | API test và dashboard E2E |

## Baseline đã xác minh

- Vitest: 47/47 pass (11 domain/property-based và 36 API/configuration).
- Tổng coverage backend: 98.27% line, 93.92% branch, 100% function. Ngưỡng CI được cấu hình: line/statements/functions ≥85%, branch ≥70%.
- StrykerJS: 132 mutants gồm 88 killed, 16 survived, 2 no-coverage, 26 compile-error; mutation score 84,62% = `killed / (killed + survived)`, không tính compile-error vào mẫu số, đạt ngưỡng 60%.
- Playwright Chromium: 24/24 pass trên Desktop Chrome và Pixel 5, gồm 12 scenario student/admin; axe kiểm tra login, student portal và admin console.
- Lighthouse production preview: Performance 100, Accessibility 100, Best Practices 96.
- k6 availability: 20 VUs/2 phút, 2.390 requests, checks 100%, error rate 0%, p95 15.98 ms.
- k6 booking race: 20 VUs đồng thời, 1 response `201`, 19 response `409`, checks 100%, error rate 0%, p95 370.25 ms; summary đã loại JWT setup data trước lưu artifact.
- OWASP ZAP: chưa chạy trong môi trường local hiện tại; workflow release sẽ tạo artifact frontend và public API trước khi kết luận.
- Backend TypeScript và frontend Vite production build pass.
