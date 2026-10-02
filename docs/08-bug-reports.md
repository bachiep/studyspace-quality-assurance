# Bug Reports

Tài liệu này chỉ ghi nhận lỗi đã được tạo và đóng trên GitHub. Kết quả retest tham chiếu đến test tự động và CI đã có trong repository; không sử dụng lỗi giả định.

## BUG-001 — Luồng đặt chỗ thiếu bước xác nhận

| Trường | Nội dung |
|---|---|
| Nguồn | [GitHub issue #1](https://github.com/bachiep/studyspace-quality-assurance/issues/1) — Closed |
| Severity | Medium |
| Phân hệ | Student booking |
| Requirement liên quan | REQ-BOOK-01 |
| Môi trường phát hiện | Giao diện student cục bộ, trước commit sửa |
| Tiền điều kiện | Student đã đăng nhập và có slot trống |
| Bước tái hiện | 1. Chọn một slot trống. 2. Quan sát hành vi sau thao tác chọn slot. |
| Actual result | Request tạo booking được gửi ngay, người dùng không có cơ hội xác nhận lại phòng, ngày và giờ. |
| Expected result | Hệ thống hiển thị hộp thoại xác nhận; chỉ tạo booking khi người dùng chọn xác nhận. Đóng/hủy hộp thoại không tạo booking. |
| Cách sửa | Bổ sung modal xác nhận trong `BookingPanel` và cập nhật luồng E2E để chọn nút `Xác nhận đặt chỗ`. |
| Fix commit | [`14279ac`](https://github.com/bachiep/studyspace-quality-assurance/commit/14279ac8fb4027958d1758b63167dcdeff8dc4e7) |
| Retest | `TC-E2E-01`; test xác minh dialog có tên `Xác nhận đặt chỗ` xuất hiện trước khi chọn nút xác nhận. Test Summary Report ghi nhận E2E Chromium 9/9 pass. |
| Trạng thái | Closed / Retested |

## BUG-004 — SQLite contention trả lỗi hệ thống khi booking đồng thời

| Trường | Nội dung |
|---|---|
| Nguồn | [GitHub issue #7](https://github.com/bachiep/studyspace-quality-assurance/issues/7) — Closed |
| Severity | Critical |
| Phân hệ | Booking integrity và performance/reliability |
| Requirement liên quan | REQ-BOOK-02 |
| Môi trường phát hiện | k6 20 VUs đồng thời trên backend SQLite test database |
| Bước tái hiện | 1. Seed test database. 2. Đăng nhập Student seed. 3. Gửi 20 POST `/bookings` đồng thời cùng room/date/startTime. |
| Actual result | Một số request bị SQLite write contention và phản hồi `500` thay vì conflict contract `409`. |
| Expected result | Đúng một booking `201`; toàn bộ request cạnh tranh còn lại `409`; không có lỗi hệ thống. |
| Cách sửa | Tuần tự hóa write booking trong SQLite single-instance; vẫn giữ transaction và active-key unique constraint làm lớp toàn vẹn database. |
| Fix commit | [`7be5a44`](https://github.com/bachiep/studyspace-quality-assurance/commit/7be5a44) |
| Retest | `TC-API-31` (20 request) và `TC-NF-02`: 1 response `201`, 19 response `409`, error rate 0%, p95 292.09 ms. |
| Trạng thái | Closed / Retested |

## BUG-002 — CI chưa khởi tạo SQLite trước E2E

| Trường | Nội dung |
|---|---|
| Nguồn | [GitHub issue #2](https://github.com/bachiep/studyspace-quality-assurance/issues/2) — Closed |
| Severity | High |
| Phân hệ | Hạ tầng kiểm thử CI |
| Requirement liên quan | Không áp dụng; lỗi thuộc môi trường thực thi kiểm thử, không phải yêu cầu chức năng SUT. |
| Môi trường phát hiện | GitHub Actions runner sạch |
| Bước tái hiện | Chạy workflow CI/E2E trên runner chưa có `DATABASE_URL` và chưa áp schema SQLite. |
| Actual result | Prisma không có database sẵn sàng, làm bước seed/E2E không thể xác nhận các luồng Playwright. |
| Expected result | Workflow dùng SQLite riêng cho CI và áp schema trước khi seed/E2E. |
| Cách sửa | Khai báo `DATABASE_URL=file:./ci.db` trong workflow và thêm bước `npm run prisma:push --workspace backend` trước test/E2E. |
| Fix commit | [`fd37daa`](https://github.com/bachiep/studyspace-quality-assurance/commit/fd37daa9508bb4588cceddf4d9d035941a4f3371) |
| Retest | Commit sửa ghi nhận chạy cục bộ 9 Playwright E2E pass; CI hiện chạy schema trước test, mutation, build và E2E. Test Summary Report ghi nhận E2E Chromium 9/9 pass. |
| Trạng thái | Closed / Retested |

## BUG-003 — Xung đột active booking chưa được bảo vệ đủ ở tầng database

| Trường | Nội dung |
|---|---|
| Nguồn | [GitHub issue #4](https://github.com/bachiep/studyspace-quality-assurance/issues/4) — Closed |
| Severity | Critical |
| Phân hệ | Booking integrity và database |
| Requirement liên quan | REQ-BOOK-02 |
| Môi trường phát hiện | Review nghiệp vụ và kiểm thử API đồng thời trên SQLite |
| Bước tái hiện | 1. Gửi đồng thời hai booking cùng Student, ngày và giờ nhưng hai room khác nhau; hoặc hủy/no-show một booking rồi thử đặt lại cùng slot. |
| Actual result | Ràng buộc cũ chỉ biểu diễn room/date/slot; không thể hiện invariant Student active-slot ở tầng database và không giải phóng invariant theo trạng thái cuối. |
| Expected result | Database phải chặn cả room active-slot và Student active-slot khi cạnh tranh; hủy/no-show giải phóng slot mà không mất lịch sử. |
| Cách sửa | Thêm `activeSlotKey` và `activeUserSlotKey` unique, tạo/cập nhật chúng trong transaction cùng audit log, xóa khóa khi CANCELLED/NO_SHOW; bổ sung migration và API tests. |
| Fix commit | [`80d474c`](https://github.com/bachiep/studyspace-quality-assurance/commit/80d474cf06de159bca7dce6be36ceedaad5cf130) |
| Retest | `TC-API-04`, `TC-API-07`, `TC-API-19`, `TC-API-29`; kết quả 36/36 unit/API pass. |
| Trạng thái | Closed / Retested |

## BUG-005 — Tạo closure cho phòng không tồn tại không giữ not-found contract

| Trường | Nội dung |
|---|---|
| Nguồn | [GitHub issue #9](https://github.com/bachiep/studyspace-quality-assurance/issues/9) — Closed |
| Severity | Medium |
| Phân hệ | Quản lý lịch đóng phòng |
| Requirement liên quan | REQ-ROOM-05 |
| Môi trường phát hiện | Review API contract với SQLite |
| Bước tái hiện | Gọi `POST /admin/rooms/missing-room/closures` bằng JWT Admin, với ngày và lý do hợp lệ. |
| Actual result | Tầng tạo closure dựa vào lỗi khóa ngoại của database; response có thể thành `500` thay vì lỗi nghiệp vụ công khai. |
| Expected result | Trả `404` với `error: NOT_FOUND` và không tạo closure. |
| Cách sửa | Kiểm tra room tồn tại bằng `findUniqueOrThrow` trước khi tạo closure, để dùng error handler `P2025` chuẩn hóa `404`; thêm `TC-API-34`. |
| Fix commit | [`7e827d6`](https://github.com/bachiep/studyspace-quality-assurance/commit/7e827d65bafde9260a4894b630fc4092ebb54496) |
| Retest | `TC-API-34` pass; CI run [36946619870](https://github.com/bachiep/studyspace-quality-assurance/actions/runs/36946619870) success. |
| Trạng thái | Closed / Retested |

## Quy ước truy vết

- `BUG-001` được liên kết với `REQ-BOOK-01` trong RTM và với `TC-E2E-01` trong test-case catalog.
- `BUG-002` chỉ liên kết với evidence CI trong báo cáo lỗi vì không thay đổi một yêu cầu chức năng của SUT.
- `BUG-003` và `BUG-004` liên kết với REQ-BOOK-02, test API concurrent và k6 booking race trong RTM.
- `BUG-005` liên kết với REQ-ROOM-05 và `TC-API-34` trong RTM.
