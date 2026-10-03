import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const output = process.argv[2] || "reports/generated/evidence/manifest.json";
const candidates = [
  "backend/coverage/coverage-summary.json",
  "reports/generated/stryker/mutation.json",
  "reports/generated/playwright-results.json",
  "reports/generated/k6/availability-summary.json",
  "reports/generated/k6/booking-race-summary.json",
  "reports/generated/lighthouse/report.json",
  "reports/generated/zap/frontend.json",
  "reports/generated/zap/api.json"
];
const existing = candidates.filter((relativePath) => fs.existsSync(path.join(root, relativePath)));
const required = [
  "backend/coverage/coverage-summary.json",
  "reports/generated/k6/availability-summary.json",
  "reports/generated/k6/booking-race-summary.json",
  "reports/generated/lighthouse/report.json",
  "reports/generated/zap/frontend.json",
  "reports/generated/zap/api.json"
];
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const version = (command, args) => {
  try { return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split(/\r?\n/)[0]; }
  catch { return null; }
};

function mutationResult(report) {
  const mutants = Object.values(report.files ?? {}).flatMap((file) => file.mutants ?? []);
  const count = (status) => mutants.filter((mutant) => mutant.status === status).length;
  const killed = count("Killed");
  const survived = count("Survived");
  const noCoverage = count("NoCoverage");
  const compileError = count("CompileError");
  const measured = killed + survived;
  return { killed, survived, noCoverage, compileError, score: measured === 0 ? null : Number((killed * 100 / measured).toFixed(2)) };
}

function zapResult(report) {
  const alerts = (report.site ?? []).flatMap((site) => site.alerts ?? []);
  const risks = { high: 0, medium: 0, low: 0, informational: 0 };
  for (const alert of alerts) {
    const risk = String(alert.riskdesc ?? alert.risk ?? "").toLowerCase();
    const key = Object.keys(risks).find((candidate) => risk.startsWith(candidate));
    if (key) risks[key] += Number(alert.count ?? alert.instances?.length ?? 1);
  }
  return risks;
}

const results = {};
if (existing.includes("backend/coverage/coverage-summary.json")) results.coverage = readJson("backend/coverage/coverage-summary.json").total;
if (existing.includes("reports/generated/stryker/mutation.json")) results.mutation = mutationResult(readJson("reports/generated/stryker/mutation.json"));
if (existing.includes("reports/generated/playwright-results.json")) results.playwright = readJson("reports/generated/playwright-results.json").stats;
for (const name of ["availability", "booking-race"]) {
  const relativePath = `reports/generated/k6/${name}-summary.json`;
  if (existing.includes(relativePath)) (results.k6 ??= {})[name] = readJson(relativePath).metrics;
}
if (existing.includes("reports/generated/lighthouse/report.json")) {
  const categories = readJson("reports/generated/lighthouse/report.json").categories;
  results.lighthouse = Object.fromEntries(Object.entries(categories).map(([id, category]) => [id, Math.round(category.score * 100)]));
}
for (const name of ["frontend", "api"]) {
  const relativePath = `reports/generated/zap/${name}.json`;
  if (existing.includes(relativePath)) (results.zap ??= {})[name] = zapResult(readJson(relativePath));
}

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    commit: process.env.GITHUB_SHA || process.env.COMMIT_SHA || "local-uncommitted",
    runUrl: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
    workflow: process.env.GITHUB_WORKFLOW || "local"
  },
  environment: { node: process.version, platform: `${process.platform}-${process.arch}` },
  tools: {
    npm: version(process.platform === "win32" ? "npm.cmd" : "npm", ["--version"]),
    lighthouse: version(process.platform === "win32" ? "npx.cmd" : "npx", ["--no-install", "lighthouse", "--version"]),
    k6: version("k6", ["version"]),
    zapImage: version("docker", ["image", "inspect", "ghcr.io/zaproxy/zaproxy:stable", "--format", "{{index .RepoDigests 0}}"])
  },
  commands: {
    traceability: "npm run qa:trace",
    automatedSecurityChecks: "npm test",
    availability: "k6 run --summary-export ... tests/non-functional/performance/availability.js",
    bookingRace: "k6 run --summary-export ... tests/non-functional/performance/booking-race.js",
    lighthouse: "lighthouse http://127.0.0.1:5173 --only-categories=performance,accessibility,best-practices",
    zap: "zap-baseline.py -I (frontend and public /rooms API)"
  },
  thresholds: {
    coverage: { lines: 85, branches: 70, functions: 85, statements: 85 },
    mutationScore: 60,
    lighthouse: { performance: 80, accessibility: 90, bestPractices: 90 },
    k6: { checksRate: 1, requestFailureRateMax: 0.01, availabilityP95MsMax: 500 },
    zap: { highAlerts: 0 }
  },
  completeness: { complete: required.every((relativePath) => existing.includes(relativePath)), missing: required.filter((relativePath) => !existing.includes(relativePath)) },
  results,
  artifacts: existing.map((relativePath) => {
    const content = fs.readFileSync(path.join(root, relativePath));
    return { path: relativePath.replaceAll("\\", "/"), bytes: content.length, sha256: crypto.createHash("sha256").update(content).digest("hex") };
  })
};

fs.mkdirSync(path.dirname(path.join(root, output)), { recursive: true });
fs.writeFileSync(path.join(root, output), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Evidence manifest written to ${output} with ${existing.length} hashed artifact(s).`);
