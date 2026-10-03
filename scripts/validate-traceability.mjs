import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field.length > 0 || row.length > 0) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const [headers, ...values] = rows.filter((item) => item.some((value) => value.trim() !== ""));
  return values.map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index] ?? ""])));
}

const splitIds = (value, prefix) => [...value.matchAll(new RegExp(`${prefix}-[A-Z0-9]+-\\d{2}|${prefix}-\\d{3}`, "g"))].map(([id]) => id);
const splitPaths = (value) => value.split(";").map((item) => item.trim()).filter((item) => item && item !== "—");
const duplicates = (items) => [...new Set(items.filter((item, index) => items.indexOf(item) !== index))];
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

const catalog = parseCsv(read("docs/04-test-cases.csv"));
const rtm = parseCsv(read("docs/03-rtm.csv"));
const srsRequirements = [...new Set(read("docs/01-srs.md").match(/REQ-(?:AUTH|ROOM|BOOK|REPORT)-\d{2}/g) ?? [])];
const bugLog = new Set(read("docs/08-bug-reports.md").match(/BUG-\d{3}/g) ?? []);
const catalogIds = catalog.map((row) => row["Test Case ID"]);
const rtmRequirementIds = rtm.map((row) => row["Requirement ID"]);

check(duplicates(catalogIds).length === 0, `Duplicate test IDs: ${duplicates(catalogIds).join(", ")}`);
check(duplicates(rtmRequirementIds).length === 0, `Duplicate RTM requirement IDs: ${duplicates(rtmRequirementIds).join(", ")}`);
for (const requirementId of srsRequirements) check(rtmRequirementIds.includes(requirementId), `${requirementId} is declared in the SRS but absent from the RTM.`);
for (const requirementId of rtmRequirementIds) check(srsRequirements.includes(requirementId), `${requirementId} is present in the RTM but absent from the SRS.`);

for (const row of catalog) {
  const testId = row["Test Case ID"];
  const requirementIds = row["Requirement ID"].match(/REQ-(?:AUTH|ROOM|BOOK|REPORT)-\d{2}/g) ?? [];
  check(testId.length > 0, "A test catalog row has no Test Case ID.");
  check(requirementIds.length > 0 || row["Requirement ID"].startsWith("N/A"), `${testId} has no requirement mapping or explicit N/A rationale.`);
  for (const requirementId of requirementIds) {
    check(rtmRequirementIds.includes(requirementId), `${testId} references unknown ${requirementId}.`);
    const rtmRow = rtm.find((item) => item["Requirement ID"] === requirementId);
    check(Boolean(rtmRow) && splitIds(rtmRow["Test case IDs"], "TC").includes(testId), `${testId} maps to ${requirementId} in the catalog but is absent from that RTM row.`);
  }
  const source = row["Test source"];
  check(Boolean(source) && fs.existsSync(path.join(root, source)), `${testId} source does not exist: ${source || "<empty>"}.`);
  for (const evidence of splitPaths(row.Evidence)) check(fs.existsSync(path.join(root, evidence)), `${testId} evidence path does not exist: ${evidence}.`);
  for (const bugId of splitIds(row["Bug ID"], "BUG")) check(bugLog.has(bugId), `${testId} references undocumented ${bugId}.`);
}

for (const row of rtm) {
  const requirementId = row["Requirement ID"];
  const testIds = splitIds(row["Test case IDs"], "TC");
  check(testIds.length > 0, `${requirementId} has no test cases in the RTM.`);
  for (const testId of testIds) check(catalogIds.includes(testId), `${requirementId} references unknown ${testId}.`);
  for (const evidence of splitPaths(row.Evidence)) check(fs.existsSync(path.join(root, evidence)), `${requirementId} evidence path does not exist: ${evidence}.`);
  for (const bugId of splitIds(row["Bug ID"], "BUG")) check(bugLog.has(bugId), `${requirementId} references undocumented ${bugId}.`);
}

for (const row of catalog.filter((item) => item.Automation === "Automated")) {
  const testId = row["Test Case ID"];
  const source = row["Test source"];
  if (!source || !fs.existsSync(path.join(root, source))) continue;
  const content = read(source);
  const escapedId = testId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const executablePattern = source.endsWith(".js")
    ? new RegExp(`export\\s+const\\s+testCaseId\\s*=\\s*["']${escapedId}["']`, "g")
    : new RegExp(`(?:it|test)\\(\\s*["']\\[${escapedId}\\]`, "g");
  const matches = content.match(executablePattern) ?? [];
  check(matches.length === 1, `${testId} must identify exactly one executable test in ${source}; found ${matches.length}.`);
}

const registered = new Set(catalogIds);
const sourceFiles = [...new Set(catalog.map((row) => row["Test source"]).filter(Boolean))];
for (const source of sourceFiles) {
  if (!fs.existsSync(path.join(root, source))) continue;
  const content = read(source);
  const foundIds = content.match(/TC-(?:UNIT|PBT|API|E2E|NF)-\d{2}/g) ?? [];
  for (const testId of new Set(foundIds)) check(registered.has(testId), `${source} contains unregistered ${testId}.`);
  if (!source.endsWith(".js")) {
    const titles = [...content.matchAll(/(?:it|test)\(\s*["']([^"']+)["']/g)].map((match) => match[1]);
    for (const title of titles) check(/^\[TC-(?:UNIT|PBT|API|E2E)-\d{2}\]/.test(title), `${source} has an executable test without a leading Test Case ID: "${title}".`);
  }
}

if (errors.length > 0) {
  console.error(`Traceability validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Traceability OK: ${rtm.length} requirements, ${catalog.length} test cases, ${bugLog.size} documented defects.`);
