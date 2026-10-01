export default {
  mutate: ["backend/src/domain/booking-policy.ts"],
  testRunner: "vitest",
  vitest: {
    configFile: "backend/vitest.config.ts",
    dir: "backend",
    related: true
  },
  checkers: ["typescript"],
  tsconfigFile: "backend/tsconfig.json",
  coverageAnalysis: "perTest",
  reporters: ["progress", "html", "json"],
  htmlReporter: { fileName: "reports/generated/stryker/index.html" },
  jsonReporter: { fileName: "reports/generated/stryker/mutation.json" },
  thresholds: { high: 80, low: 60, break: 60 },
  ignorePatterns: ["reports/**", "frontend/**", "test-results/**", "dist/**", "coverage/**"],
  concurrency: 2
};
