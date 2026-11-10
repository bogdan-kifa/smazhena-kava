const fs = require("node:fs");
const files = process.argv.slice(2);
if (files.length === 0 || files.length % 2 === 0) {
  throw new Error("Provide an odd number of Lighthouse reports.");
}
const reports = files.map((file) => {
  const report = JSON.parse(fs.readFileSync(file, "utf8"));
  if (report.runtimeError) throw new Error(report.runtimeError.message);
  return report;
});
let passed = true;
for (const key of ["performance", "accessibility", "best-practices", "seo"]) {
  const scores = reports.map((report) => report.categories[key]?.score);
  if (!scores.every(Number.isFinite)) throw new Error("Missing Lighthouse score: " + key);
  const ordered = [...scores].sort((a, b) => a - b);
  const median = ordered[Math.floor(ordered.length / 2)];
  console.log(key + ": " + Math.round(median * 100) +
    " (samples: " + scores.map((score) => Math.round(score * 100)).join(", ") + ")");
  if (median < 0.9) passed = false;
}
if (!passed) process.exitCode = 1;
