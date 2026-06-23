#!/usr/bin/env node
// ─── validate-reports.mjs — anti-fabrication guardrail ───────────────────────
// CLAUDE.md says "ห้าม fabricate" historical numbers, but nothing enforced it.
// This blocks a push when a report makes historical claims with no sourcing.
//
//   Run:  node scripts/validate-reports.mjs                 (all reports)
//         node scripts/validate-reports.mjs NVDA_20260622.json   (specific)
//   Exit code 1 if any BLOCKING issue is found (wired into push-report.sh).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.resolve(__dirname, "..", "web", "data", "reports");

const isUrl = (s) => typeof s === "string" && /^https?:\/\//.test(s);

const argv = process.argv.slice(2);
const files = (argv.length ? argv.map((a) => path.basename(a)) : fs.readdirSync(REPORTS_DIR))
  .filter((f) => f.endsWith(".json"));

let hardFails = 0, warns = 0;
const log = [];

for (const f of files) {
  let r;
  try { r = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), "utf-8")); }
  catch { log.push(`❌ ${f}: invalid JSON`); hardFails++; continue; }

  const errs = [], warnings = [];
  const sources = Array.isArray(r.sources) ? r.sources.filter(isUrl) : [];

  // BLOCKING: a report with zero real source URLs is unverifiable
  if (sources.length === 0) errs.push("no valid source URLs (sources[] empty)");
  else if (sources.length < 2) warnings.push(`only ${sources.length} source URL — thin sourcing (aim ≥2)`);

  // comparableCases are historical claims → must be backed by sources + complete
  if (Array.isArray(r.comparableCases) && r.comparableCases.length) {
    if (sources.length === 0) errs.push(`${r.comparableCases.length} comparableCases but no sources to back them`);
    r.comparableCases.forEach((c, i) => {
      if (!c?.note || !c?.date || c?.movePct == null)
        warnings.push(`comparableCases[${i}] missing note/date/movePct`);
    });
  }

  // catalystSpot historical averages must cite an exampleDate (per CLAUDE.md)
  if (r.catalystSpot) {
    for (const k of ["postWin", "postLose"]) {
      const v = r.catalystSpot[k];
      if (v && !v.exampleDate)
        warnings.push(`catalystSpot.${k} has no exampleDate (historical avg w/o reference)`);
    }
  }

  // rankChangeSource must carry a real url if present
  if (r.rankChangeSource && !isUrl(r.rankChangeSource.url))
    errs.push("rankChangeSource present but url missing/invalid");

  if (errs.length) { hardFails += errs.length; log.push(`❌ ${f}\n   - ${errs.join("\n   - ")}`); }
  if (warnings.length) { warns += warnings.length; log.push(`⚠️  ${f}\n   - ${warnings.join("\n   - ")}`); }
}

if (log.length) console.log(log.join("\n"));
console.log(`\nvalidate-reports: ${files.length} report(s) · ${hardFails} blocking · ${warns} warning(s)`);
if (hardFails > 0) {
  console.error("\n🛑 Blocking issues found — fix sourcing before pushing.");
  process.exit(1);
}
console.log("✅ all reports pass the sourcing guardrail");
