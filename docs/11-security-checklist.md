# Security Checklist

Checklist này ghi nhận phạm vi đã kiểm tra của StudySpace. “Đạt” chỉ có nghĩa là đã có evidence nêu trong bảng, không phải khẳng định hệ thống không có mọi loại rủi ro.

| Hạng mục | Kiểm tra | Evidence | Trạng thái |
|---|---|---|---|
| Mật khẩu | Chỉ lưu bcrypt hash; API không trả password hash. | `backend/src/auth.ts`, `TC-API-09`, SRS UC-AUTH-01 | Đạt |
| JWT | Token sai/hết hạn bị từ chối `401`; production thiếu JWT secret không khởi động. | `TC-API-20`, `TC-API-33` | Đạt |
| RBAC | Student bị chặn tại toàn bộ endpoint `/admin/*` trước validation/truy cập dữ liệu. | `TC-API-28` | Đạt |
| Brute-force login | Request login không thành công bị giới hạn theo client; mặc định 5 lần/15 phút, cấu hình qua environment; vượt ngưỡng trả `429`. | `TC-API-35`, BUG-006 | Đạt trong mô hình single-instance |
| Input validation | Zod kiểm tra body/query/date/slot; input sai trả `422` contract. | `TC-API-22`, `TC-API-23`, `TC-API-25`, `TC-API-27` | Đạt |
| CORS | Chỉ origin frontend được cấu hình nhận CORS header. | `TC-API-30` | Đạt |
| HTTP headers | Helmet; xác minh `nosniff` và `SAMEORIGIN`. | `TC-API-20` | Đạt |
| Error contract | Prisma duplicate/not-found và domain errors được chuẩn hóa, không trả stack trace cho client. | `TC-API-04`, `TC-API-34`, ZAP baseline | Đạt trong phạm vi test |
| Secrets | `.env` và database cục bộ bị loại khỏi Git; `.env.example` không có secret thật. | `.gitignore`, `backend/.env.example` | Đạt |
| Dependency risk | Audit runtime dependency không có High/Critical. | CI security step | Đạt |
| Dynamic scan | ZAP baseline JSON frontend/API gắn với commit và workflow; High alert phải bằng 0. | `quality-evidence.yml`, `docs/evidence/final/manifest.json`, run 37328055551 | Đạt gate High = 0; frontend 0H/0M/9L, API 0H/0M/0L |

## Phân tích finding ZAP final

| Phạm vi | Finding | Mức/đếm | Xử lý và giới hạn |
|---|---|---:|---|
| Frontend | COEP/COOP/CORP header missing hoặc invalid | Low / 9 | Ghi nhận để harden header khi triển khai; không chặn quality gate hiện tại vì ứng dụng local không dùng cross-origin isolation. |
| API | CSP directive thiếu fallback | Medium / 3 instances | Đã sửa bằng CSP tường minh trên response thành công và fallback 404; ZAP retest run 37140920740 còn 0 Medium. |
| API | Permissions-Policy header chưa đặt | Low / 3 | Đã đặt header ở API middleware; ZAP retest run 37140920740 còn 0 Low. |
| Frontend/API | Nội dung storable/cacheable và insight log | Low/Informational | Không phải lỗi xác thực; kiểm tra cache-control và log vận hành khi triển khai production. |

Các finding Medium/Low không bị che giấu. ZAP baseline này unauthenticated và public-scope, nên không thay thế authenticated scan, manual review hoặc penetration test.

## Giới hạn đã biết

- Rate limit dùng memory store, phù hợp instance backend đơn trong phạm vi hiện tại. Triển khai nhiều instance cần shared store và cấu hình reverse-proxy phù hợp.
- ZAP baseline là scan không xác thực; không thay thế kiểm thử xâm nhập hoặc authenticated scan chuyên sâu.
- Không đưa OAuth, thanh toán, email/SMS hoặc đa cơ sở vào phạm vi SRS nên không có kiểm thử security cho các chức năng đó.
