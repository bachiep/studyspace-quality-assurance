import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "reports/generated/playwright", open: "never" }], ["json", { outputFile: "reports/generated/playwright-results.json" }]],
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure", screenshot: "only-on-failure", video: "retain-on-failure" },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 5"] } }
  ],
  webServer: [
    { command: "cross-env DATABASE_URL=file:./test.db npm run dev --workspace backend", url: "http://127.0.0.1:4000/health", reuseExistingServer: false, timeout: 30_000 },
    { command: "npm run dev --workspace frontend", url: "http://127.0.0.1:5173", reuseExistingServer: false, timeout: 30_000 }
  ]
});
