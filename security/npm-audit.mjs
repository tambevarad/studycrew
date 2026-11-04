// PB-17 · NFR-02 — production dependency audit. Pass: 0 high / critical.
//   node security/npm-audit.mjs            (writes security/out/npm-audit.json, prints a summary, exit 1 on high/critical)
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const res = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
  maxBuffer: 64 * 1024 * 1024,
});
let report;
try {
  report = JSON.parse(res.stdout);
} catch {
  console.error("npm audit didn't return JSON:", res.stderr || res.stdout);
  process.exit(2);
}
mkdirSync("security/out", { recursive: true });
writeFileSync("security/out/npm-audit.json", JSON.stringify(report, null, 2));

const counts = report.metadata?.vulnerabilities ?? {};
const line = ["critical", "high", "moderate", "low", "info"].map((s) => `${s}: ${counts[s] ?? 0}`).join(" · ");
console.log(`npm audit --omit=dev → ${line}`);
for (const [name, v] of Object.entries(report.vulnerabilities ?? {})) {
  if (v.severity === "high" || v.severity === "critical") {
    const via = (v.via ?? []).map((x) => (typeof x === "string" ? x : x.title)).join("; ");
    console.log(`  ${v.severity.toUpperCase()} ${name} ${v.range ?? ""} — ${via}${v.fixAvailable ? " (fix available)" : ""}`);
  }
}
const bad = (counts.high ?? 0) + (counts.critical ?? 0);
console.log(bad === 0 ? "PASS: no high/critical production vulnerabilities." : `FAIL: ${bad} high/critical.`);
process.exit(bad === 0 ? 0 : 1);
