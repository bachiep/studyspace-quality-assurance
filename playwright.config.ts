import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  reporter: [["list"], ["html", { outputFolder: "reports/generated/playwright", open: "never" }]],
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "npm run dev --workspace backend", url: "http://127.0.0.1:4000/health", reuseExistingServer: true, timeout: 30_000 },
    { command: "npm run dev --workspace frontend", url: "http://127.0.0.1:5173", reuseExistingServer: true, timeout: 30_000 }
  ]
});
