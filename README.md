# StudySpace — xây dựng và kiểm định chất lượng

StudySpace là hệ thống web quản lý phòng học và đặt chỗ do nhóm tự xây dựng. Hệ thống được dùng làm **Software Under Test (SUT)** cho bài tập lớn môn Đánh giá và kiểm định chất lượng phần mềm; các công cụ kiểm thử trong repository là phương tiện để đánh giá SUT, không phải một sản phẩm kiểm thử độc lập.

## Phạm vi SUT

StudySpace có hai vai trò:

- `STUDENT`: đăng ký, đăng nhập, cập nhật hồ sơ, tìm phòng theo ngày/sức chứa/thiết bị, đặt chỗ, hủy, check-in và xem lịch sử.
- `ADMIN`: quản lý người dùng, phòng, thiết bị, lịch đóng phòng, trạng thái booking và báo cáo sử dụng.

Các quy tắc chính gồm slot 60 phút trong khung 07:00–21:00, đặt trong 14 ngày, phòng phải hoạt động và không bị đóng, không trùng phòng–ngày–slot hoặc sinh viên–ngày–slot, hủy trước tối thiểu 60 phút và check-in trong cửa sổ ±15 phút. Thời gian nghiệp vụ dùng múi giờ `Asia/Ho_Chi_Minh`.

Thanh toán, OAuth, email/SMS, chat realtime, bản đồ và đa cơ sở không thuộc phạm vi SRS.

## Công nghệ và cấu trúc

- Frontend: React, Vite, TypeScript.
- Backend: Express, TypeScript, JWT, bcrypt và Helmet.
- Dữ liệu: Prisma ORM với SQLite; migration được lưu trong `backend/prisma/migrations`.
- Tổ chức chính: `frontend/`, `backend/`, `tests/`, `docs/`, `fixtures/`, `scripts/` và `reports/`.

## Yêu cầu môi trường

- Node.js 22.x và npm 10.x.
- Git.
- Chromium chỉ cần thiết khi chạy Playwright; k6, Lighthouse và ZAP cần được cài khi chạy các workflow evidence tương ứng.

## Cài đặt và chạy cục bộ

```powershell
Copy-Item backend/.env.example backend/.env
npm ci
npm run db:generate
npm run db:setup
```

`db:setup` tạo file SQLite nếu cần, áp các migration đã version hóa bằng `prisma migrate deploy`, sau đó seed dữ liệu demo. Không dùng `prisma db push` trong quy trình chuẩn.

Nếu muốn xóa và tạo lại database demo cục bộ, dùng lệnh tường minh:

```powershell
npm run db:reset
```

Lệnh này xóa dữ liệu của database được cấu hình cho môi trường hiện tại, áp lại migration và seed. Chỉ chạy trên database demo/test đã xác định; không dùng trên dữ liệu cần bảo tồn.

Mở hai terminal để chạy ứng dụng:

```powershell
npm run dev --workspace backend
npm run dev --workspace frontend
```

Địa chỉ mặc định:

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:4000`
- Health check: `http://127.0.0.1:4000/health`

Tài khoản demo sau khi seed:

```text
Admin:   admin@studyspace.local / StudySpace123!
Student: student@studyspace.local / StudySpace123!
```

Không sử dụng các tài khoản demo này trong môi trường triển khai thật.

## Bộ kiểm định

Nhóm lựa chọn công cụ có thể chạy lại từ mã nguồn và CI:

| Phạm vi | Công cụ | Bằng chứng chính |
|---|---|---|
| Unit/white-box và coverage | Vitest, V8 coverage | `backend/tests/booking-policy.spec.ts`, `backend/coverage/` |
| Property-based | fast-check | Bất biến ngày, slot và cửa sổ check-in |
| API black-box và database | Supertest, Prisma, SQLite | `backend/tests/api.spec.ts` |
| Mutation | StrykerJS | `reports/generated/stryker/` |
| Browser E2E | Playwright, axe | `tests/e2e/studyspace.spec.ts` và HTML report |
| Hiệu năng và race condition | k6 | `tests/non-functional/performance/` và summary JSON |
| Security baseline | OWASP ZAP, npm audit, checklist RBAC | `.github/workflows/quality-evidence.yml`, `docs/11-security-checklist.md` |
| Accessibility và chất lượng giao diện | Lighthouse, axe | Lighthouse JSON/HTML và E2E accessibility checks |
| Truy vết | `npm run qa:trace` | `docs/03-rtm.csv`, `docs/04-test-cases.csv`, `docs/08-bug-reports.md` |

Supertest, Playwright và k6 là các lựa chọn kiểm thử có mã nguồn và artifact tái lập được; chúng lần lượt đảm nhiệm các vai trò thường được thực hiện bằng request thủ công/Postman, Selenium và JMeter. Repository không ghi nhận kết quả của công cụ chưa thực thi.

## Lệnh kiểm tra

```powershell
# Kiểm tra requirement → test case → defect → evidence
npm run qa:trace

# Unit, property-based, API và coverage
npm test

# Mutation testing cho booking policy
npm run test:mutation

# Type-check và production build
npm run build

# E2E Chromium desktop/mobile; Playwright tự khởi động backend/frontend
npm run e2e
```

Để chạy k6 booking race trên database test sạch:

```powershell
npm run db:seed:e2e
$env:DATABASE_URL = "file:./test.db"
npm run dev --workspace backend
# terminal khác
k6 run tests/non-functional/performance/booking-race.js
```

Kịch bản race yêu cầu đúng một response `201` và các request còn lại `409`; summary JSON được lưu trong `reports/generated/k6/` khi chạy workflow evidence.

## CI và evidence

- [`ci.yml`](.github/workflows/ci.yml) chạy trên push/PR: audit dependency runtime, migration, traceability, unit/API/coverage, mutation, build và Playwright.
- [`quality-evidence.yml`](.github/workflows/quality-evidence.yml) chạy thủ công hoặc khi tạo tag release: k6, Lighthouse, ZAP, manifest và artifact đầy đủ.
- [`docs/evidence/final/manifest.json`](docs/evidence/final/manifest.json) là bản kê gọn của evidence: commit đã kiểm thử, workflow, phiên bản môi trường, threshold, số liệu và SHA-256 artifact.

Evidence snapshot hiện được gắn với commit kiểm thử `17059a973875881f4f60a12800b7e891a880a03b`:

- 47/47 unit/property/API pass;
- 98,35% line, 94,02% branch, 100% function;
- mutation score 80,19% theo `killed / (killed + survived)` (85 killed, 21 survived; 27 compile error và 2 no-coverage được tách khỏi mẫu số);
- Playwright 24/24 trên Chromium desktop/mobile;
- k6 availability p95 2,63 ms và booking race một `201`, 19 `409` (p95 42,45 ms);
- Lighthouse Performance 100, Accessibility 100, Best Practices 96;
- ZAP baseline không có High alert (frontend: 9 Low/6 Informational; public API: 4 Informational).

Các số liệu trên chỉ áp dụng cho commit, workload và môi trường được ghi trong manifest; chúng không phải chứng nhận tuyệt đối cho mọi môi trường triển khai. ZAP là unauthenticated baseline, k6 là workload local single-instance, và chưa có đánh giá Firefox/WebKit hoặc authenticated penetration test.

### Trạng thái rà soát cục bộ

Lần rà soát ngày 29/10/2026 đã chạy lại `npm run qa:trace`, `npm test`, `npm run build`, `npm run e2e` và `npm audit --omit=dev --omit=optional --audit-level=high`: các gate đều đạt; backend 47/47 test pass, coverage 98,35% line, 94,02% branch, 100% function, E2E 24/24 và runtime audit trả `found 0 vulnerabilities`. Hai workflow tương ứng là [Core CI](https://github.com/bachiep/studyspace-quality-assurance/actions/runs/40800039637) và [quality evidence](https://github.com/bachiep/studyspace-quality-assurance/actions/runs/40800516515). Dependency remediation đã cập nhật Express/body-parser, Vite, Zod, express-rate-limit, ip-address và qs.

Finding dependency ban đầu được theo dõi tại [issue #33](https://github.com/bachiep/studyspace-quality-assurance/issues/33). Issue chỉ được đóng sau khi các thay đổi này có fix commit, workflow CI/evidence trên GitHub và retest evidence gắn với cùng commit.

Các file JSON trực tiếp dưới `docs/evidence/` là summary lịch sử. Chỉ `docs/evidence/final/manifest.json` và artifact của workflow tương ứng được dùng làm bằng chứng final, với điều kiện dependency audit và các gate đã được chạy lại trên commit nộp.

## Tài liệu

- [SRS](docs/01-srs.md)
- [Test Plan](docs/02-test-plan.md)
- [Requirement Traceability Matrix](docs/03-rtm.csv)
- [Test Case Catalog](docs/04-test-cases.csv)
- [ISO/IEC 25010:2023 assessment](docs/06-iso25010.md)
- [Test Summary Report](docs/07-test-summary-report.md)
- [Bug reports và retest](docs/08-bug-reports.md)
- [Security checklist](docs/11-security-checklist.md)
- [Báo cáo tổng hợp](docs/12-final-submission-report.md)

Báo cáo DOCX trong `output/docx/` vẫn là bản nháp cho đến khi nhóm điền thông tin trường, khoa, giảng viên, thành viên và MSSV thật. Không commit secret, database cục bộ, log cá nhân hoặc artifact sinh tạm.

## Repository

Repository công khai: <https://github.com/bachiep/studyspace-quality-assurance>
