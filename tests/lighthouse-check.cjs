const fs = require("node:fs");
const report = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (report.runtimeError) throw new Error(report.runtimeError.message);
let passed = true;
for (const key of ["performance", "accessibility", "best-practices", "seo"]) {
  const score = report.categories[key]?.score;
  console.log(key + ": " + (typeof score === "number" ? Math.round(score * 100) : "unavailable"));
  if (typeof score !== "number" || score < 0.9) passed = false;
}
if (!passed) process.exitCode = 1;
