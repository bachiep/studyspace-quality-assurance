import fs from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("Usage: node scripts/sanitize-k6-summary.mjs <summary.json>");
const report = JSON.parse(fs.readFileSync(file, "utf8"));
if (report.setup_data && typeof report.setup_data === "object") {
  delete report.setup_data.token;
}
fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Sanitized sensitive setup data from ${file}`);
