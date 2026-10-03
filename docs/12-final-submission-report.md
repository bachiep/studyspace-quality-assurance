# BẢN NHÁP - BÁO CÁO BÀI TẬP LỚN

## Đánh giá và kiểm định chất lượng phần mềm - StudySpace

> **Thông tin phải hoàn thiện trước khi nộp:** `[TRƯỜNG]`, `[KHOA]`, `[GIẢNG VIÊN]`, `[NHÓM]`, `[HỌ TÊN - MSSV]`.

## Tóm tắt

StudySpace là **Software Under Test (SUT)**: hệ thống quản lý phòng học và đặt chỗ. Mục tiêu bài tập không phải xây một công cụ kiểm thử độc lập, mà là xác định yêu cầu chất lượng, thiết kế và thực thi kiểm thử nhiều tầng, quản lý defect, rồi đánh giá chất lượng SUT bằng bằng chứng tái lập được. Bộ Vitest, Supertest, fast-check, Playwright, StrykerJS, k6, OWASP ZAP và Lighthouse là phương tiện kiểm định đi kèm SUT.

Báo cáo áp dụng nguyên tắc `Requirement -> Technique -> Test case -> Raw result -> Defect/Fix -> Retest`. Một kết luận không có evidence được ghi là **chưa đánh giá**. Bản hiện tại vẫn là bản nháp vì thông tin bìa chưa được cung cấp; evidence snapshot đã gắn với commit kiểm thử `512c073` và hai workflow cuối.

## 1. Phân công và kế hoạch

| Thành viên | MSSV | Trách nhiệm | Bằng chứng đóng góp |
|---|---|---|---|
| `[HỌ TÊN]` | `[MSSV]` | `[PHÂN CÔNG]` | `[COMMIT/ISSUE/PHẦN BÁO CÁO]` |

Kế hoạch thực hiện gồm: đặc tả SRS; thiết kế kiến trúc và dữ liệu; hiện thực bốn phân hệ; thiết kế test theo rủi ro; thực thi kiểm thử chức năng/phi chức năng; ghi nhận và sửa defect; kiểm thử hồi quy; tổng hợp evidence và đánh giá ISO/IEC 25010:2023.

## 2. Phạm vi và yêu cầu SUT

Hệ thống có hai vai trò nghiệp vụ. `STUDENT` quản lý hồ sơ, tìm phòng theo ngày/sức chứa/thiết bị, đặt/hủy/check-in và xem lịch sử. `ADMIN` quản lý người dùng, phòng, thiết bị, lịch đóng, trạng thái booking và báo cáo. `Guest` xem trang giới thiệu và đăng ký/đăng nhập.

| Phân hệ | Mã yêu cầu | Nội dung trọng tâm |
|---|---|---|
| Xác thực/phân quyền | `REQ-AUTH-*` | Đăng ký, đăng nhập JWT, hồ sơ, ADMIN/STUDENT RBAC |
| Phòng học | `REQ-ROOM-*` | Tìm phòng, ACTIVE/INACTIVE, thiết bị và lịch đóng |
| Booking | `REQ-BOOK-*` | Slot 60 phút, 14 ngày, conflict, hủy, check-in, lịch sử |
| Báo cáo | `REQ-REPORT-*` | Thống kê theo trạng thái, reservation/utilization và phòng phổ biến |

Quy tắc cốt lõi: 14 slot từ 07:00 đến 21:00; ngày đặt từ hôm nay đến ngày thứ 14 theo thời gian cơ sở; phòng phải ACTIVE, đủ sức chứa/thiết bị và không bị đóng; không trùng room-slot hoặc user-slot; hủy trước giờ bắt đầu ít nhất 60 phút; check-in trong cửa sổ -15 đến +15 phút. Room có lịch sử được chuyển INACTIVE thay vì xóa cứng. Phạm vi không gồm thanh toán, OAuth, email/SMS, bản đồ, đa cơ sở và chat thời gian thực.

Đặc tả actor, precondition, postcondition, main/alternate/exception flow nằm trong `docs/01-srs.md`.

## 3. Thiết kế và kiến trúc

Kiến trúc ba tầng gồm React/Vite/TypeScript/Tailwind ở presentation; Express/Zod/JWT/RBAC và booking policy ở application/domain; Prisma/SQLite ở data. Các thực thể là `User`, `Room`, `Equipment`, `RoomEquipment`, `RoomClosure`, `Booking` và `AuditLog`.

Booking lưu hai active key duy nhất theo room-slot và user-slot. Khi booking chuyển sang trạng thái cuối, khóa active được giải phóng nhưng bản ghi lịch sử được giữ. Trong phạm vi SQLite single-instance, booking-state write được tuần tự hóa; unique constraint và transaction vẫn là lớp bảo vệ dữ liệu. HTTP `409` là contract cho xung đột nghiệp vụ.

Sơ đồ use case, ERD và component được duy trì ở `docs/00-diagrams.md` và được render trong PDF. Môi trường cục bộ đã kiểm thử dùng HTTP trên loopback; HTTPS chỉ là yêu cầu triển khai, chưa có evidence trong repository.

## 4. Môi trường và khả năng tái lập

- Runtime: Node.js, TypeScript; frontend React/Vite; backend Express/Prisma/SQLite.
- Bootstrap database mới: `npm run db:setup`, chỉ dùng migration versioned rồi seed.
- Reset demo/test database: `npm run db:reset`; đây là thao tác phá hủy dữ liệu và phải dùng trên database được chọn rõ.
- Unit/API dùng isolated SQLite database; E2E seed dữ liệu riêng trước khi chạy.
- `docs/evidence/bootstrap-summary.json` ghi nhận migration trên database tạm. Fresh-clone summary cũ không được dùng làm bằng chứng final; manifest final trỏ tới core/evidence workflow gắn `512c073`.

## 5. Test Plan và kỹ thuật thiết kế

Ưu tiên rủi ro: race booking, bypass quyền ADMIN, sai ngày/múi giờ, sai thống kê và mất lịch sử khi xóa phòng. Testing pyramid đặt phần lớn kiểm tra ở unit/domain và API/database, còn E2E kiểm tra luồng quan trọng.

| Tầng | Công cụ | Kỹ thuật | Mục tiêu/evidence |
|---|---|---|---|
| Unit/domain | Vitest, V8 | White-box, BVA, state transition | Slot, ngày, hủy, check-in, coverage |
| Property-based | fast-check | Invariant/property | Thời lượng slot, phạm vi ngày, cửa sổ check-in |
| API/database | Supertest, Prisma | EP, BVA, decision table, API black-box, concurrency | Contract, RBAC, validation, transaction, audit, conflict |
| E2E | Playwright, axe | Scenario/state transition/accessibility | Luồng Student/Admin và responsive viewport |
| Mutation | StrykerJS | Mutation testing | Độ nhạy test của `booking-policy.ts` |
| Performance | k6 | Load/race và threshold | p95, throughput, error rate, 201/409 |
| Security | OWASP WSTG, ZAP | Negative API và unauthenticated baseline | Auth, authorization, session, input, error, business logic |
| UI quality | Lighthouse | Automated audit | Performance, accessibility, best practices |

Entry criteria: migration/seed thành công, build được, test data và browser sẵn sàng. Exit criteria: suite bắt buộc pass; line >=85%, branch >=70%, mutation >=60%; mỗi API nghiệp vụ có ca dương và ca âm/biên phù hợp; race có đúng một `201`; ZAP không có High; k6 và Lighthouse đạt threshold đã khai báo.

## 6. Thực thi và kết quả có bằng chứng

| Hoạt động | Kết quả trong summary hiện có | Giới hạn |
|---|---|---|
| Unit + PBT + API | 47/47 pass | Chạy local sau đợt sửa correctness/a11y |
| V8 coverage | Line 98,29%; branch 93,95%; function 100% | Chỉ source được instrument trong cấu hình |
| Mutation | 86 killed; 20 survived; 2 no-coverage; 27 compile-error; 81,13% | Chỉ `booking-policy.ts`; dùng `killed / (killed + survived)`, compile-error và no-coverage báo cáo riêng |
| E2E Chromium | 24/24 pass; 12 scenario trên desktop/mobile | Không đại diện Firefox/WebKit |
| k6 availability | 20 VUs/2 phút; 2.400 request; checks 100%; error 0%; p95 4,63 ms | Một máy/môi trường và một workload |
| k6 booking race | 1 x `201`, 19 x `409`; checks 100%; error 0%; p95 41,19 ms | SQLite single-instance; summary đã sanitize JWT |
| ZAP baseline | Frontend 0H/0M/9L/7I; API 0H/0M/0L/3I | Unauthenticated baseline; không phải pentest authenticated |
| Lighthouse production preview | Performance 100; Accessibility 100; Best Practices 96 | Một URL và môi trường local production preview |

Các số liệu final trong bảng được lấy từ `docs/evidence/final/manifest.json`, với core run `37140913623` và quality-evidence run `37140920740`, đều gắn commit kiểm thử `14cd9a3`. Mutation score là `86 / (86 + 20) = 81,13%`; no-coverage và 27 compile-error được báo cáo riêng. Raw artifact đầy đủ nằm trong artifact của GitHub Actions, không được chép vào repository.

## 7. Truy vết và quản lý defect

RTM ánh xạ 15 requirement sang kỹ thuật, test case, source và evidence. `npm run qa:trace` trên core workflow xác nhận 15 requirement, 61 test case và 7 defect; test ID phải xuất hiện trong catalog lẫn tên test và được kiểm tra tự động.

Các defect đã ghi nhận gồm: thiếu bước xác nhận booking, CI database provisioning, thiếu database invariant cho active booking, SQLite contention, closure not-found contract, login brute-force protection và thiếu positive check-in coverage. Mỗi defect trong `docs/08-bug-reports.md` có bước tái hiện, expected/actual, severity, fix commit và retest. Issue #3/#5/#6/#8/#12 là task chất lượng/hardening và được phân loại riêng thay vì gắn nhãn defect SUT không chính xác.

Issue #13 (date/time) và #14 (audit/report semantics) đã có fix và retest. Các issue workflow/evidence #16–#20 đã có retest trong hai workflow cuối; issue #15 chỉ được đóng sau khi manifest snapshot, RTM và report được đối chiếu lần cuối.

## 8. Đánh giá ISO/IEC 25010:2023

Báo cáo sử dụng chín đặc tính của phiên bản 2023: Functional suitability, Performance efficiency, Compatibility, Interaction capability, Reliability, Security, Maintainability, Flexibility và Safety. Bảng metric/evidence/giới hạn đầy đủ nằm ở `docs/06-iso25010.md`.

- Functional suitability có RTM/test nhưng chỉ trong SRS.
- Performance efficiency có hai kịch bản k6, không suy diễn cho mọi workload.
- Compatibility mới được kiểm tra trên hai viewport Chromium.
- Interaction capability có Lighthouse/axe và luồng E2E, chưa có usability study với người dùng.
- Reliability có conflict/race evidence và rollback test; phạm vi kết luận atomicity là các mutation đã có test.
- Security có JWT/RBAC/validation/rate-limit và baseline scan giới hạn (API 0 High/Medium/Low sau hardening), không tương đương pentest; frontend còn 9 Low COEP/COOP/CORP cần đánh giá khi triển khai thực tế.
- Maintainability có TypeScript, migration, coverage/mutation; mutation chỉ ở domain policy.
- Flexibility có cấu hình/migration/bootstrap trên môi trường đã ghi, chưa chứng minh đa DBMS.
- Safety chưa đánh giá và nằm ngoài phạm vi vì không có hazard analysis.

Đây là đánh giá dựa trên mô hình chất lượng, không phải chứng nhận ISO.

## 9. Giới hạn và kết luận

StudySpace có phạm vi SUT phù hợp với học phần và có nền tảng kiểm thử đa tầng. Bản báo cáo vẫn giữ nhãn **BẢN NHÁP** cho tới khi placeholder bìa được thay bằng dữ liệu thật và issue #15 được đóng với bằng chứng retest. Core và quality-evidence workflow hiện đã xanh; manifest ghi SHA, run, phiên bản công cụ và hash artifact.

Kết luận hiện tại: **có bằng chứng tích cực cho các phạm vi đã chạy, nhưng chưa đủ điều kiện tuyên bố hoàn thiện 100% hoặc đạt toàn diện**.

## Tài liệu tham khảo

Danh mục URL chính thức nằm tại `docs/10-references.md`, gồm ISO/IEC 25010:2023, ISO/IEC 25023, OWASP WSTG 4.2, Playwright, k6, ZAP, StrykerJS, Vitest và Lighthouse.
