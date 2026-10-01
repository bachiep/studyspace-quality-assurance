# Đặc tả yêu cầu phần mềm (SRS) — StudySpace

## 1. Mục đích, phạm vi và quy ước

StudySpace là hệ thống quản lý phòng tự học và đặt chỗ theo khung giờ cố định. Tài liệu này mô tả **hành vi đang được hiện thực** của phiên bản nộp bài; không phải danh sách tính năng dự kiến trong tương lai.

Sản phẩm gồm bốn phân hệ: (1) tài khoản, xác thực và phân quyền; (2) phòng, thiết bị và lịch đóng; (3) booking, hủy, check-in và xử lý xung đột; (4) vận hành người dùng, booking và báo cáo sử dụng.

Ngoài phạm vi: thanh toán, email/SMS, OAuth, bản đồ, đa cơ sở, chat thời gian thực, tự động gửi nhắc lịch và tự động chuyển booking thành `NO_SHOW` theo thời gian.

Các mã yêu cầu dùng tiền tố `REQ-AUTH`, `REQ-ROOM`, `REQ-BOOK`, `REQ-REPORT`. Use case dùng tiền tố `UC-*` để truy vết sang test case, bug và evidence.

## 2. Tác nhân và quyền hạn

| Tác nhân | Mô tả | Quyền trong hệ thống |
|---|---|---|
| Khách | Người chưa đăng nhập | Đăng ký, đăng nhập, xem danh mục phòng active và khả dụng theo ngày. |
| Student | Người dùng có vai trò `STUDENT` | Xem/cập nhật hồ sơ của mình; tìm phòng; tạo, xem, hủy và check-in booking của chính mình. |
| Admin | Người dùng có vai trò `ADMIN` | Quản lý phòng, thiết bị, lịch đóng; xem/cập nhật người dùng, booking và báo cáo. |

Mọi endpoint `/admin/*` yêu cầu JWT hợp lệ có vai trò `ADMIN`. JWT hợp lệ nhưng không phải admin nhận `403`; thiếu JWT hoặc JWT hết hạn/không hợp lệ nhận `401`.

## 3. Dữ liệu và quy tắc nghiệp vụ

### 3.1 Đối tượng dữ liệu

| Đối tượng | Thuộc tính nghiệp vụ chính | Ràng buộc chính |
|---|---|---|
| `User` | tên, email, password hash, vai trò | Email duy nhất; vai trò `STUDENT` hoặc `ADMIN`. |
| `Room` | tên, sức chứa, vị trí, trạng thái | Tên duy nhất; trạng thái `ACTIVE` hoặc `INACTIVE`. |
| `Equipment` | tên thiết bị | Tên duy nhất; liên kết phòng qua `RoomEquipment`. |
| `RoomClosure` | phòng, ngày, lý do | Duy nhất theo phòng và ngày. |
| `Booking` | người đặt, phòng, ngày, start/end time, trạng thái | Duy nhất theo room, ngày, giờ bắt đầu; trạng thái `BOOKED`, `CANCELLED`, `CHECKED_IN`, `NO_SHOW`. |
| `AuditLog` | tác nhân, hành động, thực thể, metadata, thời điểm | Ghi nhận thao tác nghiệp vụ quan trọng. |

### 3.2 Quy tắc booking

| Mã | Quy tắc |
|---|---|
| BR-BOOK-01 | Một slot kéo dài 60 phút. Giờ bắt đầu hợp lệ `07:00` đến `20:00`; giờ kết thúc tương ứng `08:00` đến `21:00`. |
| BR-BOOK-02 | Ngày có dạng `YYYY-MM-DD`, từ ngày hiện tại đến tối đa 14 ngày tới, và slot không được nằm trong quá khứ. |
| BR-BOOK-03 | Chỉ phòng `ACTIVE` không có closure trong ngày được chọn mới được đặt. |
| BR-BOOK-04 | Không có hai booking cùng phòng/ngày/giờ bắt đầu. Unique constraint là lớp bảo vệ cuối cùng cho yêu cầu đồng thời. |
| BR-BOOK-05 | Một Student không giữ hai booking `BOOKED` hoặc `CHECKED_IN` cùng ngày và giờ bắt đầu. |
| BR-BOOK-06 | Chỉ hủy booking của mình khi còn `BOOKED` và còn ít nhất 60 phút trước giờ bắt đầu. |
| BR-BOOK-07 | Chỉ check-in booking của mình khi còn `BOOKED`, trong cửa sổ từ 15 phút trước đến 15 phút sau giờ bắt đầu. |
| BR-ROOM-01 | Phòng có lịch sử không bị xóa qua chức năng quản trị; `INACTIVE` dùng để ngừng nhận booking mới. |

## 4. Yêu cầu chức năng

| ID | Yêu cầu | Tiêu chí chấp nhận có thể kiểm chứng |
|---|---|---|
| REQ-AUTH-01 | Đăng ký tài khoản Student | Tên 2–80 ký tự, email hợp lệ, mật khẩu 8–72 ký tự; password được hash; trả JWT và hồ sơ công khai. |
| REQ-AUTH-02 | Đăng nhập và xác thực phiên | Thông tin hợp lệ trả JWT hạn 8 giờ; thông tin sai và token thiếu/hết hạn/sai trả `401`. |
| REQ-AUTH-03 | Hồ sơ người dùng | Người dùng đã đăng nhập xem/cập nhật tên, email của mình; thay đổi được audit. |
| REQ-AUTH-04 | Phân quyền | Student bị chặn khỏi `/admin/*`; Admin không tự hạ quyền của mình. |
| REQ-ROOM-01 | Tra cứu phòng công khai | Chỉ trả phòng `ACTIVE`; hỗ trợ lọc sức chứa tối thiểu và danh sách tên thiết bị. |
| REQ-ROOM-02 | Xem khả dụng theo ngày | Trả phòng active, closure ngày đó và slot bị chiếm bởi `BOOKED`/`CHECKED_IN`. |
| REQ-ROOM-03 | Quản lý phòng | Admin tạo/cập nhật tên, sức chứa, vị trí, trạng thái; tên duy nhất; thay đổi được audit. |
| REQ-ROOM-04 | Quản lý thiết bị | Admin xem, tạo, xóa thiết bị chưa dùng và thay thế danh sách thiết bị của phòng; thay đổi được audit. |
| REQ-ROOM-05 | Lịch đóng phòng | Admin tạo/xem/xóa closure theo phòng/ngày/lý do; ngày đóng chặn booking; thay đổi được audit. |
| REQ-BOOK-01 | Tạo booking | Student tạo booking hợp lệ; booking mặc định `BOOKED`, có end time và audit. |
| REQ-BOOK-02 | Ngăn xung đột | Phát hiện xung đột Student; DB chặn xung đột phòng đồng thời và API trả `409` cho unique conflict. |
| REQ-BOOK-03 | Xem lịch sử | Student chỉ xem booking của mình, kèm thông tin phòng, sắp ngày/giờ tăng dần. |
| REQ-BOOK-04 | Hủy và check-in | Student chỉ hủy/check-in booking của mình theo BR-BOOK-06/07; thao tác thành công có audit. |
| REQ-REPORT-01 | Vận hành người dùng và booking | Admin xem người dùng/booking, thay đổi role người dùng khác và trạng thái booking; thay đổi được audit. |
| REQ-REPORT-02 | Báo cáo sử dụng | Admin xem tổng booking, check-in, no-show, occupancy rate và phòng theo lượt booking giảm dần. |

## 5. Đặc tả use case

### UC-AUTH-01 — Đăng ký tài khoản

- **Yêu cầu liên kết:** REQ-AUTH-01.
- **Tác nhân:** Khách.
- **Tiền điều kiện:** Chưa có phiên đăng nhập; email chưa tồn tại.
- **Kích hoạt:** Khách gửi tên, email và mật khẩu.
- **Luồng chính:** (1) Hệ thống kiểm tra dữ liệu. (2) Chuẩn hóa email về chữ thường, băm mật khẩu, tạo `User` có vai trò `STUDENT`. (3) Tạo JWT hạn 8 giờ. (4) Trả `201`, token và hồ sơ không chứa password hash.
- **Luồng thay thế/ngoại lệ:** Dữ liệu không hợp lệ trả `422`; email đã tồn tại trả `409`.
- **Hậu điều kiện:** Có Student mới với email duy nhất; không lưu mật khẩu dạng rõ.

### UC-AUTH-02 — Đăng nhập

- **Yêu cầu liên kết:** REQ-AUTH-02.
- **Tác nhân:** Khách.
- **Tiền điều kiện:** Tài khoản đã tồn tại.
- **Kích hoạt:** Khách gửi email và mật khẩu.
- **Luồng chính:** (1) Kiểm tra định dạng. (2) Tìm email đã chuẩn hóa và so sánh mật khẩu với hash. (3) Tạo JWT hạn 8 giờ, trả `200`, token và hồ sơ công khai.
- **Luồng thay thế/ngoại lệ:** Dữ liệu sai định dạng trả `422`; email không tồn tại hoặc mật khẩu không khớp trả `401` với cùng thông báo.
- **Hậu điều kiện:** Không thay đổi dữ liệu; người dùng có token để gọi API cần xác thực.

### UC-AUTH-03 — Xem và cập nhật hồ sơ

- **Yêu cầu liên kết:** REQ-AUTH-03.
- **Tác nhân:** Student hoặc Admin đã đăng nhập.
- **Tiền điều kiện:** JWT hợp lệ; tài khoản tương ứng còn tồn tại.
- **Kích hoạt:** Người dùng mở hoặc lưu hồ sơ.
- **Luồng chính:** (1) Xác thực JWT. (2) Khi xem, trả id, tên, email, vai trò, ngày tạo của chính người dùng. (3) Khi cập nhật, kiểm tra tên và email. (4) Cập nhật hồ sơ, ghi `PROFILE_UPDATED`, trả hồ sơ công khai.
- **Luồng thay thế/ngoại lệ:** Token không hợp lệ trả `401`; tên/email không hợp lệ trả `422`; email đã dùng trả `409`.
- **Hậu điều kiện:** Nếu thành công, hồ sơ và audit log được cập nhật; vai trò và mật khẩu không đổi qua use case này.

### UC-ROOM-01 — Tìm phòng và xem khả dụng

- **Yêu cầu liên kết:** REQ-ROOM-01, REQ-ROOM-02.
- **Tác nhân:** Khách, Student hoặc Admin.
- **Tiền điều kiện:** Với tra cứu khả dụng, ngày có dạng `YYYY-MM-DD`.
- **Kích hoạt:** Người dùng tìm phòng hoặc chọn ngày xem slot.
- **Luồng chính:** (1) Người dùng có thể gửi sức chứa tối thiểu/danh sách tên thiết bị khi tra cứu. (2) Hệ thống chỉ trả room `ACTIVE`, sắp theo tên, kèm thiết bị. (3) Với ngày được chọn, lấy closure và booking `BOOKED`/`CHECKED_IN`. (4) Trả `available` và `occupiedSlots` cho từng room active.
- **Luồng thay thế/ngoại lệ:** Ngày sai định dạng trả `422`; sức chứa không phải số hữu hạn không được dùng để tạo điều kiện lọc.
- **Hậu điều kiện:** Không thay đổi dữ liệu.

### UC-ROOM-02 — Tạo hoặc cập nhật phòng

- **Yêu cầu liên kết:** REQ-ROOM-03, BR-ROOM-01.
- **Tác nhân:** Admin.
- **Tiền điều kiện:** JWT hợp lệ có vai trò `ADMIN`; khi cập nhật, room id tồn tại.
- **Kích hoạt:** Admin lưu phòng hoặc đổi trạng thái.
- **Luồng chính:** (1) Admin nhập tên, sức chứa 1–500, vị trí; lúc tạo có thể nhập tên thiết bị. (2) Hệ thống kiểm tra và tạo room `ACTIVE`, liên kết/tạo thiết bị theo tên nếu có. (3) Khi cập nhật gửi ít nhất một trong tên, sức chứa, vị trí, trạng thái. (4) Hệ thống lưu, ghi `ROOM_CREATED`, `ROOM_UPDATED` hoặc `ROOM_STATUS_CHANGED`, trả room mới.
- **Luồng thay thế/ngoại lệ:** Thiếu/sai token `401`; Student `403`; dữ liệu sai `422`; room không tồn tại `404`; tên trùng `409`.
- **Hậu điều kiện:** Room mới/cập nhật được lưu; `INACTIVE` không có trong tra cứu công khai và không nhận booking mới.

### UC-ROOM-03 — Quản lý thiết bị và gán thiết bị cho phòng

- **Yêu cầu liên kết:** REQ-ROOM-04.
- **Tác nhân:** Admin.
- **Tiền điều kiện:** JWT hợp lệ có vai trò `ADMIN`; room tồn tại khi gán.
- **Kích hoạt:** Admin thêm/xóa danh mục hoặc lưu thiết bị của phòng.
- **Luồng chính:** (1) Hệ thống hiển thị thiết bị cùng số phòng đang dùng. (2) Admin tạo thiết bị tên 2–80 ký tự, hệ thống ghi `EQUIPMENT_CREATED`. (3) Khi gán, Admin gửi tối đa 50 equipment id; hệ thống kiểm tra mọi id, thay thế liên kết cũ trong transaction, ghi `ROOM_EQUIPMENT_UPDATED`. (4) Admin xóa thiết bị chưa gán; hệ thống ghi `EQUIPMENT_DELETED`, trả `204`.
- **Luồng thay thế/ngoại lệ:** Không xác thực/không phải admin `401`/`403`; dữ liệu sai `422`; room/thiết bị không tồn tại `404` hoặc `EQUIPMENT_NOT_FOUND` (`422`); xóa thiết bị đang gán trả `422` `EQUIPMENT_IN_USE`; tên trùng `409`.
- **Hậu điều kiện:** Danh mục/liên kết `RoomEquipment` phản ánh thao tác thành công; không có liên kết trùng do khóa ghép.

### UC-ROOM-04 — Cấu hình lịch đóng phòng

- **Yêu cầu liên kết:** REQ-ROOM-05, BR-BOOK-03.
- **Tác nhân:** Admin.
- **Tiền điều kiện:** JWT hợp lệ có vai trò `ADMIN`; room tồn tại khi tạo closure.
- **Kích hoạt:** Admin thêm, xem hoặc xóa lịch đóng.
- **Luồng chính:** (1) Admin gửi ngày và lý do 3–200 ký tự. (2) Hệ thống tạo `RoomClosure`, ghi `ROOM_CLOSED`, trả `201`. (3) Hệ thống cho xem closure theo room, sắp ngày tăng dần. (4) Khi xóa, hệ thống xóa bản ghi, ghi `ROOM_CLOSURE_DELETED`, trả `204`.
- **Luồng thay thế/ngoại lệ:** Không xác thực/không phải admin `401`/`403`; dữ liệu sai `422`; closure không tồn tại khi xóa trả `404`; closure trùng room/ngày trả `409`. Tạo closure yêu cầu room tồn tại như tiền điều kiện.
- **Hậu điều kiện:** Closure chặn booking mới ngày đó; xóa closure gỡ chặn từ closure này.

### UC-BOOK-01 — Tạo booking

- **Yêu cầu liên kết:** REQ-BOOK-01, REQ-BOOK-02; BR-BOOK-01 đến BR-BOOK-05.
- **Tác nhân:** Student hoặc Admin đã đăng nhập.
- **Tiền điều kiện:** JWT hợp lệ; room active; ngày/slot hợp lệ; room không đóng; không xung đột.
- **Kích hoạt:** Người dùng xác nhận room/date/startTime.
- **Luồng chính:** (1) Xác thực JWT, kiểm tra dữ liệu. (2) Kiểm tra slot 07:00–20:00, ngày trong 14 ngày và chưa qua. (3) Trong transaction, lấy room/closure, kiểm tra active và không đóng. (4) Kiểm tra booking `BOOKED`/`CHECKED_IN` cùng người dùng, ngày, giờ. (5) Tạo booking `BOOKED`, end time sau 60 phút; unique constraint bảo vệ room/date/startTime. (6) Ghi `BOOKING_CREATED`, trả `201` và room của booking.
- **Luồng thay thế/ngoại lệ:** Token thiếu/sai `401`; dữ liệu định dạng sai `422`; ngày/slot sai, quá hạn hoặc đã qua `422`; room thiếu/inactive `422` `ROOM_UNAVAILABLE`; room đóng `422` `ROOM_CLOSED`; Student trùng slot `422` `STUDENT_CONFLICT`; request đồng thời cùng room/date/slot `409` `BOOKING_CONFLICT`.
- **Hậu điều kiện:** Thành công tạo đúng một booking cho room/date/startTime và audit log; thất bại không tạo booking dở dang.

### UC-BOOK-02 — Xem lịch sử booking cá nhân

- **Yêu cầu liên kết:** REQ-BOOK-03.
- **Tác nhân:** Student hoặc Admin đã đăng nhập.
- **Tiền điều kiện:** JWT hợp lệ.
- **Kích hoạt:** Người dùng mở lịch sử.
- **Luồng chính:** (1) Xác thực JWT. (2) Lấy booking có `userId` bằng chủ thể JWT, kèm room. (3) Sắp ngày rồi giờ tăng dần, trả danh sách.
- **Luồng thay thế/ngoại lệ:** Token thiếu/sai/hết hạn `401`; chưa có booking trả mảng rỗng `200`.
- **Hậu điều kiện:** Không đổi dữ liệu; không trả booking của người khác.

### UC-BOOK-03 — Hủy booking

- **Yêu cầu liên kết:** REQ-BOOK-04, BR-BOOK-06.
- **Tác nhân:** Student hoặc Admin đã đăng nhập, với booking của mình.
- **Tiền điều kiện:** JWT hợp lệ; booking tồn tại và thuộc chủ thể JWT.
- **Kích hoạt:** Người dùng yêu cầu hủy booking.
- **Luồng chính:** (1) Xác thực và tìm booking. (2) Kiểm tra chủ sở hữu, trạng thái `BOOKED`, thời gian còn lại ít nhất 60 phút. (3) Đổi trạng thái `CANCELLED`, lưu `cancelledAt`. (4) Ghi `BOOKING_CANCELLED`, trả `200`.
- **Luồng thay thế/ngoại lệ:** Token sai `401`; booking không có `404`; booking người khác `403`; không còn `BOOKED` hoặc dưới 60 phút `422` `CANCELLATION_NOT_ALLOWED`.
- **Hậu điều kiện:** Booking hợp lệ đã `CANCELLED`; audit log được tạo.

### UC-BOOK-04 — Check-in booking

- **Yêu cầu liên kết:** REQ-BOOK-04, BR-BOOK-07.
- **Tác nhân:** Student hoặc Admin đã đăng nhập, với booking của mình.
- **Tiền điều kiện:** JWT hợp lệ; booking tồn tại và thuộc người gọi.
- **Kích hoạt:** Người dùng chọn check-in.
- **Luồng chính:** (1) Xác thực và tìm booking. (2) Kiểm tra quyền, trạng thái `BOOKED`, cửa sổ -15/+15 phút. (3) Đổi `CHECKED_IN`. (4) Ghi `BOOKING_CHECKED_IN`, trả `200`.
- **Luồng thay thế/ngoại lệ:** Token sai `401`; booking không có `404`; booking người khác `403`; ngoài cửa sổ hoặc không `BOOKED` trả `422` `CHECKIN_NOT_ALLOWED`.
- **Hậu điều kiện:** Booking hợp lệ chuyển `CHECKED_IN`; audit log được tạo.

### UC-REPORT-01 — Quản lý người dùng và trạng thái booking

- **Yêu cầu liên kết:** REQ-AUTH-04, REQ-REPORT-01.
- **Tác nhân:** Admin.
- **Tiền điều kiện:** JWT hợp lệ có vai trò `ADMIN`.
- **Kích hoạt:** Admin mở vận hành, đổi role hoặc trạng thái booking.
- **Luồng chính:** (1) Hệ thống trả user không chứa password hash, sắp ngày tạo tăng dần; trả booking kèm user/room và có thể lọc theo ngày. (2) Admin đổi role user khác sang `STUDENT`/`ADMIN`; ghi `USER_ROLE_CHANGED`. (3) Admin đổi trạng thái booking tồn tại sang giá trị `BookingStatus`; nếu `CANCELLED`, đặt `cancelledAt`. (4) Ghi `BOOKING_STATUS_CHANGED`, trả booking cập nhật.
- **Luồng thay thế/ngoại lệ:** Token sai `401`; Student `403`; role/status/ngày lọc sai `422`; user/booking không tồn tại `404`; Admin tự hạ role từ `ADMIN` bị chặn `422` `SELF_ROLE_CHANGE_FORBIDDEN`.
- **Hậu điều kiện:** Khi hợp lệ user/booking cập nhật và có audit log.

### UC-REPORT-02 — Xem báo cáo sử dụng

- **Yêu cầu liên kết:** REQ-REPORT-02.
- **Tác nhân:** Admin.
- **Tiền điều kiện:** JWT hợp lệ có vai trò `ADMIN`.
- **Kích hoạt:** Admin mở dashboard báo cáo.
- **Luồng chính:** (1) Lấy booking `BOOKED`, `CHECKED_IN`, `NO_SHOW`; bỏ `CANCELLED`. (2) Tính tổng booking, check-in, no-show. (3) Tính `occupancyRate = bookings / (phòng ACTIVE × 14 ngày × 14 slot) × 100`, làm tròn hai chữ số; không có phòng active thì bằng 0. (4) Gom/sắp phòng theo lượt booking giảm dần và trả `200`.
- **Luồng thay thế/ngoại lệ:** Token sai `401`; Student `403`; không có booking hợp lệ thì tổng bằng 0 và danh sách phòng rỗng.
- **Hậu điều kiện:** Không thay đổi dữ liệu.

## 6. Yêu cầu phi chức năng và kiểm định

| Nhóm | Yêu cầu kiểm chứng |
|---|---|
| Bảo mật | bcrypt, JWT/RBAC, Zod validation, HTTP security headers; ZAP không có finding High. |
| Tin cậy | Transaction và unique constraint chứng minh một cặp request đồng thời chỉ có một thành công, request còn lại `409`. |
| Hiệu năng | Kịch bản k6 công bố p95, error rate, throughput từ report sinh bởi lần chạy thật. |
| Khả dụng | Giao diện responsive; evidence accessibility/Lighthouse được lưu. |
| Khả bảo trì | TypeScript, Prisma schema, test tự động, CI, audit log; phòng lịch sử dùng `INACTIVE`. |
| Khả chuyển | Monorepo Node.js, `.env.example`, Prisma SQLite và hướng dẫn chạy từ clone mới. |

## 7. Truy vết ở mức SRS

RTM chi tiết nằm tại `docs/03-rtm.csv`. Mỗi yêu cầu ở Mục 4 phải có ít nhất một test case; thay đổi do lỗi phải liên kết từ requirement qua test case, bug, commit sửa và evidence. Các luồng ở Mục 5 là nguồn chuẩn để thiết kế test main flow, alternate flow và exception flow.
