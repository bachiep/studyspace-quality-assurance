# Sơ đồ thiết kế StudySpace

## Use Case Diagram

```mermaid
flowchart LR
  Guest((Guest)) --> Landing[Xem trang giới thiệu]
  Guest --> Auth[Đăng ký / đăng nhập]
  Student((Student)) --> Auth[Đăng ký / đăng nhập]
  Student --> Find[Tìm phòng trống]
  Student --> Book[Đặt chỗ]
  Student --> Cancel[Hủy booking]
  Student --> Checkin[Check-in]
  Student --> History[Xem lịch sử]
  Admin((Admin)) --> Users[Quản lý user & quyền]
  Admin --> Rooms[Quản lý phòng]
  Admin --> Equipment[Quản lý thiết bị]
  Admin --> Closures[Cấu hình lịch đóng]
  Admin --> Monitor[Xem booking & báo cáo]
```

## ERD

```mermaid
erDiagram
  User ||--o{ Booking : creates
  User ||--o{ AuditLog : acts
  Room ||--o{ Booking : hosts
  Room ||--o{ RoomClosure : has
  Room ||--o{ RoomEquipment : contains
  Equipment ||--o{ RoomEquipment : assigned
  User { string id PK string email UK string role }
  Room { string id PK string name UK int capacity string status }
  Booking { string id PK string date string startTime string status string activeSlotKey UK string activeUserSlotKey UK }
  RoomClosure { string id PK string date string reason }
  Equipment { string id PK string name UK }
  RoomEquipment { string roomId FK string equipmentId FK }
  AuditLog { string id PK string actorId FK string action string entity }
```

## Component Diagram và kiến trúc 3 tầng

```mermaid
flowchart TB
  UI[React + Vite + Tailwind UI] -->|HTTP / JSON ở môi trường cục bộ| API[Express Controller + Zod + Helmet]
  API --> Domain[Domain services: booking policy]
  API --> Auth[JWT / bcrypt / RBAC]
  API --> Queue[SQLite booking write queue]
  Domain --> Data[Prisma Repository]
  Queue --> Data
  Auth --> Data
  Data --> DB[(SQLite)]
  API --> Audit[Audit log]
  Audit --> DB
```

> Phạm vi được kiểm thử trong repository chạy qua HTTP trên loopback. HTTPS chỉ là yêu cầu của môi trường triển khai thực tế và chưa được chứng minh bởi evidence hiện có.

- Presentation: React screens cho Student và Admin.
- Application/domain: Express route, validation, RBAC, hàng đợi write booking cho SQLite và các quy tắc slot/booking thuần.
- Data: Prisma transaction, hai unique active-key booking, SQLite và audit trail.
