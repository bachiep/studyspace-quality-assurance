# StudySpace QA

StudySpace là hệ thống quản lý phòng tự học do nhóm tự xây dựng nhằm làm đối tượng đánh giá và kiểm định chất lượng phần mềm. Sản phẩm có hai vai trò `STUDENT` và `ADMIN`, quản lý phòng, lịch đóng phòng, booking theo slot, hủy/check-in, audit log và báo cáo sử dụng.

## Chạy dự án

```powershell
Copy-Item backend/.env.example backend/.env
npm install
npm run db:generate
Set-Location backend; npm run prisma:push; npm run prisma:seed
```

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

`npm test` và `npm run e2e` luôn reset database kiểm thử `backend/prisma/test.db` bằng Prisma migrations trước khi chạy; không tác động database phát triển.

Tài liệu kiểm định nằm trong [`docs`](docs/README.md). Kết quả sinh tự động phải để trong `reports/generated/` và không commit secrets hoặc database cục bộ.
