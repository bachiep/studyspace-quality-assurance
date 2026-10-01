# SRS rút gọn StudySpace

## 1. Phạm vi và tác nhân

StudySpace hỗ trợ sinh viên tìm và giữ chỗ trong phòng tự học; quản trị viên cấu hình tài nguyên và giám sát việc sử dụng. Không thuộc phạm vi: thanh toán, email/SMS, OAuth, bản đồ, đa cơ sở và chat.

| Tác nhân | Quyền chính |
|---|---|
| Student | Đăng ký/đăng nhập, xem phòng trống, đặt/hủy/check-in booking của bản thân |
| Admin | Quản lý phòng, lịch đóng phòng, xem booking và chỉ số vận hành |

## 2. Yêu cầu chức năng

| ID | Yêu cầu | Tiêu chí chấp nhận |
|---|---|---|
| REQ-AUTH-01 | Đăng ký và đăng nhập an toàn | Password được hash; token hết hạn sau 8 giờ |
| REQ-AUTH-02 | RBAC | Student bị chặn khỏi tất cả API `/admin/*` |
| REQ-ROOM-01 | Danh mục phòng | Room có tên duy nhất, sức chứa, vị trí, trạng thái và thiết bị |
| REQ-ROOM-02 | Lịch đóng phòng | Room bị đóng không khả dụng tại ngày đó |
| REQ-BOOK-01 | Đặt slot | Slot cố định 07:00–21:00, tối đa 14 ngày tới |
| REQ-BOOK-02 | Chống xung đột | Một room và một student không có hai booking trùng date–slot |
| REQ-BOOK-03 | Hủy/check-in | Hủy trước 60 phút; check-in trong cửa sổ -15/+15 phút |
| REQ-BOOK-04 | Audit log | Tạo/hủy booking và thay đổi phòng đều có audit log |
| REQ-REPORT-01 | Báo cáo | Hiển thị tổng booking, check-in, no-show, occupancy rate và room phổ biến |

## 3. Use case tiêu biểu

### UC-BOOK-01 Đặt phòng

- Tác nhân: Student đã đăng nhập.
- Tiền điều kiện: room active, date hợp lệ, room không đóng, slot chưa có booking.
- Luồng chính: chọn date → xem availability → chọn room/slot → xác nhận → hệ thống tạo booking và audit log.
- Luồng thay thế: slot đã bị người khác giữ trong lúc thao tác → trả `409 Conflict`; room đóng → trả `422`.
- Hậu điều kiện: booking `BOOKED` tồn tại, chỉ một booking duy nhất theo room/date/startTime.

### UC-ROOM-01 Quản lý phòng

- Tác nhân: Admin.
- Luồng chính: nhập tên, sức chứa, vị trí, thiết bị → hệ thống lưu room active và audit log.
- Ngoại lệ: Student gọi API admin → `403`; tên room trùng → `409`.

## 4. Yêu cầu phi chức năng

- Bảo mật: JWT, password hash, helmet, RBAC, validation ở API.
- Hiệu năng: đo p95 availability/booking bằng k6, error rate nhỏ hơn 1% trong bài chạy mục tiêu.
- Khả dụng: giao diện responsive, keyboard-accessible, Lighthouse Accessibility ≥90.
- Tin cậy: booking concurrent phải có một thành công và một `409`, không có dữ liệu trùng.
