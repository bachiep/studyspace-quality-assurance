import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const tomorrow = () => { const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10); };
async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill("StudySpace123!");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

test("student can reserve then cancel a future room slot", async ({ page }) => {
  await login(page, "student@studyspace.local");
  await expect(page.getByRole("heading", { name: "Chọn không gian, giữ nhịp tập trung" })).toBeVisible();
  await page.getByLabel("Ngày học").fill(tomorrow());
  await page.getByRole("button", { name: "10:00" }).first().click();
  await expect(page.getByRole("dialog", { name: "Xác nhận đặt chỗ" })).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận đặt chỗ" }).click();
  await expect(page.getByText("Đã giữ chỗ tại phòng")).toBeVisible();
  await page.getByRole("button", { name: "Hủy lịch" }).click();
  await expect(page.getByText("Đã hủy lịch đặt.")).toBeVisible();
});

test("admin sees the operational report and creates a room", async ({ page }) => {
  await login(page, "admin@studyspace.local");
  await expect(page.getByRole("heading", { name: "Vận hành không gian học tập" })).toBeVisible();
  await page.getByLabel("Tên phòng").fill(`E505-${Date.now()}`);
  await page.getByLabel("Sức chứa").fill("18");
  await page.getByLabel("Vị trí").fill("Tòa E – Tầng 5");
  await page.getByRole("button", { name: "Tạo phòng" }).click();
  await expect(page.getByText("Đã tạo phòng mới và lưu audit log.")).toBeVisible();
});

test("invalid credentials are explained to the user", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill("student@studyspace.local");
  await page.getByLabel("Mật khẩu").fill("not-the-password");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("alert")).toContainText("Email hoặc mật khẩu không chính xác.");
});

test("new student can register and enter the booking portal", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Chưa có tài khoản? Đăng ký" }).click();
  await page.getByLabel("Họ và tên").fill("Người học mới");
  await page.getByLabel("Email").fill(`new-${Date.now()}@test.local`);
  await page.getByLabel("Mật khẩu").fill("Password123!");
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page.getByRole("heading", { name: "Chọn không gian, giữ nhịp tập trung" })).toBeVisible();
});

test("admin can switch to the student view", async ({ page }) => {
  await login(page, "admin@studyspace.local");
  await page.getByRole("button", { name: "Góc nhìn sinh viên" }).click();
  await expect(page.getByText("STUDENT PORTAL")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tìm phòng trống" })).toBeVisible();
});

test("student can see the cancelled booking in history", async ({ page }) => {
  await login(page, "student@studyspace.local");
  await page.getByLabel("Ngày học").fill(tomorrow());
  await page.getByRole("button", { name: "11:00" }).first().click();
  await page.getByRole("button", { name: "Xác nhận đặt chỗ" }).click();
  await page.getByRole("button", { name: "Hủy lịch" }).click();
  await expect(page.getByRole("complementary").getByText("CANCELLED").first()).toBeVisible();
});

test("admin can manage equipment from the operations console", async ({ page }) => {
  await login(page, "admin@studyspace.local");
  await page.getByPlaceholder("Ví dụ: Máy chiếu").fill(`Loa-${Date.now()}`);
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  await expect(page.getByText("Đã thêm thiết bị.")).toBeVisible();
});

test("student can update their profile", async ({ page }) => {
  await login(page, "student@studyspace.local");
  await page.getByLabel("Họ và tên").fill("Nguyễn Minh Anh Updated");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(page.getByRole("status")).toContainText("Đã cập nhật hồ sơ.");
});

test("landing login form has no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? "")).map((item) => item.id)).toEqual([]);
});
