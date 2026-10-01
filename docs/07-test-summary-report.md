# Test Summary Report

## Phạm vi và kết quả

| Hoạt động | Kết quả | Evidence |
|---|---:|---|
| Unit + API (Vitest) | 33/33 pass (5 unit, 28 API) | `backend/tests`, `backend/coverage` |
| Coverage V8 | 96.55% line, 88.68% branch, 100% function | `backend/coverage` |
| Mutation testing | 52 killed / 11 survived / 5 compile-error mutants; score 82.54% | `reports/generated/stryker/mutation.json` |
| E2E Chromium | 9/9 pass | `reports/generated/playwright` |
| Axe login | 0 vi phạm serious/critical | Playwright report |
| Lighthouse production | Performance 100; Accessibility 100; Best Practices 96; SEO 82 | `reports/generated/lighthouse-production.report.html` |
| k6 availability | 20 VUs/2 phút; 2,382 requests; 19.69 req/s; error 0%; p95 17.47 ms; exit 0 | `reports/generated/k6-final-summary.json` |
| OWASP ZAP production baseline | 0 High, 0 Medium, 0 Low, 2 Informational | `reports/generated/zap/baseline-production.html` |
| Runtime dependency audit | 0 High/critical vulnerabilities (`--omit=dev --omit=optional`) | CI security step |

## Quyết định chất lượng

- Booking concurrent được test: một request 201, request còn lại 409; SQLite unique constraint và transaction là biện pháp phòng ngừa.
- RBAC đã có test 401/403 và API admin chỉ nhận token ADMIN.
- Token hết hạn bị từ chối và Helmet phát security headers; bằng chứng API nằm trong `backend/tests/api.spec.ts`.
- Phòng có lịch sử được chuyển `INACTIVE`, không xóa dữ liệu nghiệp vụ.
- Axe và Lighthouse production đạt ngưỡng accessibility/best practices đã đặt.
- ZAP production baseline không có alert High/Medium/Low; hai informational alert được giữ nguyên trong report.

## Evidence đã đóng

- Stryker mutation score đã đạt 82.54% (mục tiêu ≥60%).
- OWASP ZAP production baseline đã chạy, không có High/Medium/Low.

Hai mục được ghi nhận từ report thực tế, không suy diễn từ các test khác.
