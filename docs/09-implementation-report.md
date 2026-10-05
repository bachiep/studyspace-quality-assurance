# Báo cáo cài đặt StudySpace

## 1. Phạm vi bản cài đặt

StudySpace là SUT cho bài tập lớn Đánh giá và kiểm định phần mềm. Bản cài đặt gồm bốn phân hệ đã có trong SRS: xác thực và phân quyền; quản lý phòng, thiết bị, lịch đóng; booking; và vận hành/báo cáo. Không có thanh toán, OAuth, email/SMS, bản đồ, đa cơ sở hoặc chat thời gian thực.

## 2. Kiến trúc và công nghệ

Ứng dụng dùng kiến trúc ba tầng. Frontend React/Vite/TypeScript/Tailwind gửi JSON qua REST. Backend Express/TypeScript xác thực JWT, kiểm tra dữ liệu bằng Zod, thực thi policy booking và ghi audit log. Lớp dữ liệu dùng Prisma với SQLite.

| Thành phần | Công nghệ | Trách nhiệm |
|---|---|---|
| Presentation | React, Vite, TypeScript, Tailwind | Màn hình đăng nhập, student portal và admin console responsive. |
| Application | Express, Zod, Helmet, JWT, bcrypt | REST API, validation, RBAC, security header và contract lỗi HTTP. |
| Domain | `booking-policy.ts` | Slot 60 phút, giới hạn ngày, hủy và check-in theo thời gian. |
| Data | Prisma, SQLite | Ràng buộc unique, transaction, soft state `INACTIVE`, audit trail. |

Sơ đồ use case, ERD và component diagram nằm tại [00-diagrams.md](00-diagrams.md). Chi tiết requirement và use case nằm tại [01-srs.md](01-srs.md).

Ngày hiển thị ở các ô chọn ngày trên frontend cũng được tính bằng `Asia/Ho_Chi_Minh`, cùng quy ước với `booking-policy.ts` ở backend. API vẫn là lớp kiểm tra cuối cùng cho ngày không tồn tại, khoảng 14 ngày, slot đã qua, hủy và check-in; helper giao diện chỉ bảo đảm các biên hiển thị không phụ thuộc múi giờ máy người dùng.

## 3. Mô hình dữ liệu và toàn vẹn

`User`, `Room`, `Equipment`, `RoomEquipment`, `RoomClosure`, `Booking` và `AuditLog` là các thực thể nghiệp vụ. Email user, tên room và tên equipment là duy nhất. Booking lưu hai unique active-key: `roomId/date/startTime` và `userId/date/startTime` chỉ khi trạng thái là `BOOKED` hoặc `CHECKED_IN`; transaction cùng việc chuyển lỗi unique sang HTTP `409` bảo vệ cạnh tranh ở tầng API. Với SQLite single-instance, write booking đi qua hàng đợi trong process để database lock không biến conflict hợp lệ thành `500`; hai unique key vẫn là lớp toàn vẹn cuối cùng. Khi `CANCELLED` hoặc `NO_SHOW`, các khóa active được gỡ nhưng lịch sử vẫn giữ lại. Room có lịch sử chỉ đổi sang `INACTIVE`, không xóa nghiệp vụ.

## 4. REST API chính

| Nhóm | Endpoint chính |
|---|---|
| Xác thực và hồ sơ | `POST /auth/register`, `POST /auth/login`, `GET/PATCH /auth/me` |
| Room công khai | `GET /rooms`, `GET /rooms/availability` |
| Booking Student | `POST /bookings`, `GET /bookings/me`, `PATCH /bookings/:id/cancel`, `PATCH /bookings/:id/check-in` |
| Admin | `/admin/users`, `/admin/rooms`, `/admin/equipment`, room closures, `/admin/bookings`, `/admin/reports/usage` |

API quản trị yêu cầu JWT có role `ADMIN`; token thiếu/hết hạn trả `401`, role không đủ trả `403`, dữ liệu sai trả `422`, conflict booking trả `409`, tài nguyên không tồn tại trả `404`.

## 5. Cấu trúc mã nguồn

| Đường dẫn | Nội dung |
|---|---|
| `frontend/src` | UI, API client, màn hình Student/Admin và component booking/profile/operations. |
| `backend/src` | Express application, auth, database, domain policy và server entry point. |
| `backend/prisma` | Schema Prisma, SQLite seed và migration workflow. |
| `backend/tests` | Unit, property-based fast-check cho booking policy và Supertest API contract test. |
| `tests/e2e` | Playwright Chromium E2E và accessibility axe. |
| `tests/non-functional` | k6 availability và booking race scenario. |
| `docs` | SRS, diagrams, plan, RTM, test catalog, bug report, ISO 25010 và summary. |
| `.github/workflows/ci.yml` | CI: audit runtime dependency, migration deploy, test, mutation, build và E2E. |

## 6. Tái lập môi trường

Yêu cầu Node.js LTS và npm. Trong thư mục gốc:

```powershell
Copy-Item backend/.env.example backend/.env
npm install
npm run db:generate
npm run db:setup
```

`db:setup` tạo file SQLite nếu chưa có, áp dụng migration versioned và seed dữ liệu demo. Với database demo dùng schema cũ, chạy `npm run db:reset` một lần; lệnh này xóa dữ liệu của database demo cục bộ trước khi seed lại.

Chạy backend và frontend ở hai terminal bằng `npm run dev --workspace backend` và `npm run dev --workspace frontend`. Thông tin tài khoản seed và cổng dịch vụ có tại README gốc.

## 7. Tái lập kiểm định

```powershell
npm test
npm run test:mutation
npm run build
npm run e2e
```

Evidence số liệu, ngưỡng quality gate và kết quả đã chạy nằm tại [07-test-summary-report.md](07-test-summary-report.md). RTM và catalog test là nguồn truy vết chính, không thay thế bằng mô tả không có bằng chứng.
