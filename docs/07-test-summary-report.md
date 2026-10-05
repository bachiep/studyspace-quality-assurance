# Test Summary Report

## Phạm vi và kết quả

| Hoạt động | Kết quả | Evidence |
|---|---:|---|
| Unit + property-based + API (Vitest) | 47/47 pass (11 domain/property-based, 36 API/configuration) | `backend/tests`, CI quality run |
| Coverage V8 | 98.35% line, 94.02% branch, 100% function | Core CI run [37348312215](https://github.com/bachiep/studyspace-quality-assurance/actions/runs/37348312215) |
| Mutation testing | 86 killed / 20 survived / 2 no-coverage / 27 compile-error; score 81,13% (`killed / (killed + survived)`) | Core CI artifact gắn commit kiểm thử `364f3b9` |
| E2E Chromium | 24/24 pass trên Desktop Chrome và Pixel 5; 12 scenario | `tests/e2e/studyspace.spec.ts`, Playwright artifact |
| Axe login/student/admin | 0 vi phạm serious/critical trong ba trang | `tests/e2e/studyspace.spec.ts`, CI E2E step |
| Lighthouse production preview | Performance 98; Accessibility 100; Best Practices 96 | Quality evidence run [37348951730](https://github.com/bachiep/studyspace-quality-assurance/actions/runs/37348951730) |
| k6 availability | 20 VUs/2 phút; 2.400 requests; checks 100%; error 0%; p95 6.17 ms | Quality evidence run [37348951730](https://github.com/bachiep/studyspace-quality-assurance/actions/runs/37348951730) |
| k6 booking race | 20 VUs; 1 response 201, 19 response 409; checks 100%; error 0%; p95 62.06 ms | Quality evidence run [37348951730](https://github.com/bachiep/studyspace-quality-assurance/actions/runs/37348951730) (JWT sanitized) |
| OWASP ZAP baseline | Frontend 0H/0M/9L/8I; API 0H/0M/0L/2I | Quality evidence run [37348951730](https://github.com/bachiep/studyspace-quality-assurance/actions/runs/37348951730); unauthenticated baseline |
| Runtime dependency audit | 0 High/critical vulnerabilities (`--omit=dev --omit=optional`) | CI security step |
| Fresh-clone bootstrap | Summary historical, không dùng để kết luận final | `docs/evidence/final/manifest.json` và core workflow |
| Database migration isolation | Migrations áp thành công từ database test trắng trước unit/API và E2E | `docs/evidence/bootstrap-summary.json`, CI quality run |

## Quyết định chất lượng

- Booking concurrent được test cả theo phòng và theo Student: k6 xác minh 20 request cho đúng 1 response 201 và 19 response 409; hai unique active-key, transaction và hàng đợi write SQLite là biện pháp phòng ngừa.
- RBAC đã có test 401/403 và API admin chỉ nhận token ADMIN.
- Token hết hạn bị từ chối, Helmet phát security headers và CORS chỉ cấp cho origin frontend được cấu hình; bằng chứng API nằm trong `backend/tests/api.spec.ts`.
- Login không thành công bị giới hạn theo client; ngưỡng/cửa sổ cấu hình qua môi trường và vượt ngưỡng trả `429` `AUTH_RATE_LIMITED`.
- Phòng có lịch sử được chuyển `INACTIVE`, không xóa dữ liệu nghiệp vụ.
- Axe và Lighthouse production preview đạt ngưỡng accessibility/best practices đã đặt; Performance đạt 98 trong lần chạy này.
- Luồng E2E chạy tuần tự qua desktop/mobile để cùng database test không tạo xung đột giả giữa các project.
- ZAP final đã có artifact; High gate bằng 0. Các Medium/Low vẫn phải được phân tích, không được gọi là “không có finding”.

## Evidence đã đóng

- Stryker mutation score của core artifact đạt 81,13% theo công thức `killed / (killed + survived)` (mục tiêu ≥60%); no-coverage và compile-error được báo cáo riêng.
- OWASP ZAP baseline final đã chạy trong quality-evidence workflow; phạm vi chưa bao gồm authenticated scan hoặc penetration test.

Hai mục được ghi nhận từ report thực tế, không suy diễn từ các test khác.
