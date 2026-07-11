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
const DATA_ROOT = path.resolve(__dirname, "..", "web", "data");
// All report buckets share the same sourcing guardrail.
const DIRS = ["reports", "speculative", "dca"].map((d) => path.join(DATA_ROOT, d));

const isUrl = (s) => typeof s === "string" && /^https?:\/\//.test(s);

// Plain .mjs can't import the TS const, so this list is DUPLICATED from
// web/lib/factors.ts's FACTOR_TAGS — the source of truth. Update BOTH places
// when adding a tag.
const FACTOR_TAGS = [
  "ai_semi",
  "ai_software",
  "space_launch",
  "quantum",
  "ev_auto",
  "long_duration_rate",
  "single_customer",
];

const argv = process.argv.slice(2);
const wanted = argv.map((a) => path.basename(a));

// Build the work list: {dir, file} across every bucket that exists.
const targets = [];
for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    if (wanted.length && !wanted.includes(file)) continue;
    targets.push({ dir, file });
  }
}

let hardFails = 0, warns = 0;
const log = [];

for (const { dir, file: f } of targets) {
  const bucket = path.basename(dir);
  let r;
  try { r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")); }
  catch { log.push(`❌ ${bucket}/${f}: invalid JSON`); hardFails++; continue; }

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

  // DCA picks: valuation claim should cite a basis; thesis-break replaces stop loss
  if (bucket === "dca") {
    if (r.valuationBand && !r.valuationBand.basis)
      warnings.push("valuationBand has no basis (fair-value claim w/o method/source)");
    if (!Array.isArray(r.thesisBreak) || r.thesisBreak.length === 0)
      warnings.push("no thesisBreak[] — a DCA pick should state what invalidates the long-term thesis");
  }

  // rankChangeSource must carry a real url if present
  if (r.rankChangeSource && !isUrl(r.rankChangeSource.url))
    errs.push("rankChangeSource present but url missing/invalid");

  // factorTags typos (e.g. "ai-semi", "AI_semi") silently split a factor into two
  // buckets in the concentration warning — WARN, don't block (advisory field).
  if (Array.isArray(r.factorTags)) {
    const bogus = r.factorTags.filter((t) => !FACTOR_TAGS.includes(t));
    if (bogus.length) warnings.push(`factorTags has unknown value(s): ${bogus.join(", ")} (see FACTOR_TAGS in web/lib/factors.ts)`);
  }

  if (errs.length) { hardFails += errs.length; log.push(`❌ ${bucket}/${f}\n   - ${errs.join("\n   - ")}`); }
  if (warnings.length) { warns += warnings.length; log.push(`⚠️  ${bucket}/${f}\n   - ${warnings.join("\n   - ")}`); }
}
const files = targets;

if (log.length) console.log(log.join("\n"));
console.log(`\nvalidate-reports: ${files.length} report(s) · ${hardFails} blocking · ${warns} warning(s)`);
if (hardFails > 0) {
  console.error("\n🛑 Blocking issues found — fix sourcing before pushing.");
  process.exit(1);
}
console.log("✅ all reports pass the sourcing guardrail");
