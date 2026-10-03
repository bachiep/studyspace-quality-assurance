import fs from "node:fs";
import process from "node:process";

const reportPath = process.argv[2];
if (!reportPath) throw new Error("Usage: node scripts/validate-lighthouse.mjs <report.json>");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const thresholds = { performance: 80, accessibility: 90, "best-practices": 90 };
const failures = [];
for (const [category, minimum] of Object.entries(thresholds)) {
  const actual = Math.round((report.categories?.[category]?.score ?? 0) * 100);
  console.log(`${category}: ${actual} (required >= ${minimum})`);
  if (actual < minimum) failures.push(`${category}=${actual}`);
}
if (failures.length) {
  console.error(`Lighthouse thresholds failed: ${failures.join(", ")}`);
  process.exit(1);
}
