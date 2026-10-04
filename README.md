# StudySpace QA

StudySpace là hệ thống quản lý phòng tự học do nhóm tự xây dựng nhằm làm đối tượng đánh giá và kiểm định chất lượng phần mềm. Sản phẩm có hai vai trò `STUDENT` và `ADMIN`, quản lý phòng, lịch đóng phòng, booking theo slot, hủy/check-in, audit log và báo cáo sử dụng.

## Chạy dự án

```powershell
Copy-Item backend/.env.example backend/.env
npm install
npm run db:generate
npm run db:setup
```

`db:setup` áp các migration đã version hóa rồi mới seed dữ liệu demo, để môi trường cục bộ luôn theo đúng lịch sử migration.

Nếu đã có database demo theo schema cũ, chạy `npm run db:reset` một lần trước khi chạy `db:setup`. Lệnh reset chỉ dành cho database demo cục bộ và sẽ xóa dữ liệu trong database đó.

Mở hai terminal:

```powershell
npm run dev --workspace backend
npm run dev --workspace frontend
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`
- Admin: `admin@studyspace.local` / `StudySpace123!`
- Student: `student@studyspace.local` / `StudySpace123!`

## Kiểm thử

```powershell
npm test
npm run build
npm run e2e
```

`npm test`, `npm run test:mutation` và `npm run e2e` luôn reset database kiểm thử `backend/prisma/test.db` bằng Prisma migrations trước khi chạy; không tác động database phát triển.

Để chạy k6 booking race trên database test sạch, chạy `npm run db:seed:e2e`, khởi động backend với `DATABASE_URL=file:./test.db`, sau đó chạy `k6 run tests/non-functional/performance/booking-race.js`. Kịch bản yêu cầu đúng 1 response `201` và 19 response `409`.

Tài liệu kiểm định nằm trong [`docs`](docs/README.md). Kết quả sinh tự động phải để trong `reports/generated/` và không commit secrets hoặc database cục bộ.
