import fs from "node:fs";
import process from "node:process";

const files = process.argv.slice(2);
if (files.length === 0) throw new Error("Usage: node scripts/validate-zap.mjs <report.json> [...]");

function countRisk(report, riskName) {
  return (report.site ?? []).flatMap((site) => site.alerts ?? []).reduce((total, alert) => {
    const risk = String(alert.riskdesc ?? alert.risk ?? "").toLowerCase();
    if (!risk.startsWith(riskName)) return total;
    return total + Number(alert.count ?? alert.instances?.length ?? 1);
  }, 0);
}

const summaries = files.map((file) => {
  const report = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(report.site)) throw new Error(`Invalid ZAP report: ${file}`);
  return { file, high: countRisk(report, "high") };
});

const high = summaries.reduce((total, summary) => total + summary.high, 0);
if (high > 0) {
  console.error(`ZAP High alerts detected: ${high}`);
  process.exit(1);
}
console.log(`ZAP reports valid: ${summaries.length}; High alerts: ${high}.`);
