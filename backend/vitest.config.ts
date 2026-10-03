import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      include: ["src/domain/**/*.ts", "src/app.ts"],
      thresholds: { lines: 85, branches: 70, functions: 85, statements: 85 }
    }
  }
});
