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

// Plain .mjs can't import the TS helpers, so this date grammar is DUPLICATED
// from web/lib/catalyst-timing.ts (parseDateStr/catalystISO) — the source of
// truth. Update BOTH places if the date grammar changes.
const MONTH_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const isoDate = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
function parseDateStr(raw) {
  if (!raw) return null;
  const s = raw.trim();
  let m = s.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) { const mo = MONTH_MAP[m[1].toLowerCase()]; return mo === undefined ? null : isoDate(+m[3], mo, +m[2]); }
  m = s.match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (m) { const mo = MONTH_MAP[m[1].toLowerCase()]; return mo === undefined ? null : isoDate(+m[2], mo, 15); }
  m = s.match(/^Q([1-4])\s+(\d{4})$/);
  if (m) { const mid = [1, 4, 7, 10]; return isoDate(+m[2], mid[+m[1] - 1], 15); }
  m = s.match(/^H([12])\s+(\d{4})$/);
  if (m) { return isoDate(+m[2], m[1] === "1" ? 2 : 8, 15); }
  return null;
}
const catalystISO = (c) =>
  c?.catalystDate && /^\d{4}-\d{2}-\d{2}$/.test(c.catalystDate) ? c.catalystDate : parseDateStr(c?.dateBadge);

// ── Fuzzy-date grammar (backlog: phantom-date bug, commit 2653bf4) ──────────
// "Q4 2026" / "H2 2026" / "Dec 2026" parse to a phantom mid-period day (Nov 15,
// Aug 15, Dec 15) that then drives proximity sorting, the calendar and the
// post-stage flip as if it were a real event day. A genuinely fuzzy window
// must be written with a "~" prefix ("~Q4 2026"): parseDateStr ignores it,
// and web/lib/catalyst-timing.ts (isFuzzyBadge/proximityISO) keeps a "~"
// catalyst's catalystDate (its window END) out of sorting/calendar while still
// using it to tell when the window has passed.
const FUZZY_GRAMMAR = [/^[A-Za-z]{3}\s+\d{4}$/, /^Q[1-4]\s+\d{4}$/, /^H[12]\s+\d{4}$/];
const isPhantomFuzzy = (raw) => typeof raw === "string" && FUZZY_GRAMMAR.some((re) => re.test(raw.trim()));
// Reports generated on/after this date BLOCK on an un-tilded fuzzy date;
// older ones only WARN (and only if still the visible/latest report for the
// ticker) so the legacy corpus doesn't flood the output.
const FUZZY_RULE_SINCE = "2026-11-12";

// Read once, offline — no network call from the validator itself. Missing
// file / stale entries are handled per-ticker below (never blocks).
function readLivePrices() {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_ROOT, "live-prices.json"), "utf-8")).prices ?? {}; }
  catch { return {}; }
}
const LIVE_PRICES = readLivePrices();

const SCENARIO_ORDER = ["Bear", "Base", "Bull", "Moon"];

/** Midpoint of an entryLevel's range, or its flat level if no rangeMax. */
const entryLevelMid = (lvl) => (lvl ? (lvl.rangeMax != null ? (lvl.level + lvl.rangeMax) / 2 : lvl.level) : null);

/**
 * Candidate bases a report may have anchored its scenario/TP/stop % math to.
 * A full-corpus spot-check found THREE legitimate conventions in use (reports
 * predate this check, written by different runs over weeks):
 *   (1) current price (r.price) — the overwhelming majority, and the basis
 *       CLAUDE.md's own worked example uses;
 *   (2) Entry 1's own level — usually ≈ r.price, but a few reports (e.g.
 *       SERV_20260706) anchor every derived number to Entry 1's stated level
 *       even where it drifted from the top-level price field;
 *   (3) the preferred dip-buy entry's midpoint — a couple of reports (e.g.
 *       ASTS_20260621/23) say so explicitly in their own rrNote/tightNote
 *       text ("From Entry 2 preferred... tight stop").
 * Dedupes near-equal values so the common case (all three ≈ equal) is one
 * check, not three.
 */
function candidateBases(r) {
  const out = [];
  const add = (v) => { if (typeof v === "number" && v > 0 && !out.some((b) => Math.abs(b - v) <= 0.01)) out.push(v); };
  add(r.price);
  const levels = r.entryStrategy?.entryLevels;
  if (Array.isArray(levels)) {
    add(entryLevelMid(levels[0]));
    add(entryLevelMid(levels.find((l) => l?.preferred)));
  }
  return out;
}

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

// Latest file per ticker per bucket = the one the site actually shows.
const latestByBucketTicker = new Map();
for (const { dir, file } of targets) {
  const key = `${path.basename(dir)}:${file.split("_")[0]}`;
  const prev = latestByBucketTicker.get(key);
  if (!prev || file > prev) latestByBucketTicker.set(key, file);
}
// When validating specific files only, also consider every file on disk so
// "latest" is judged against the whole bucket, not just the argv subset.
for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const key = `${path.basename(dir)}:${file.split("_")[0]}`;
    const prev = latestByBucketTicker.get(key);
    if (!prev || file > prev) latestByBucketTicker.set(key, file);
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

  // ── Stale catalystDate (WARN) — every dated catalyst already in the past AT
  // GENERATION TIME is almost always a research mistake on a freshly-written
  // report. Past dates are legitimate for realized/archived picks, so this
  // never blocks. Reports with no dated catalyst at all are skipped here —
  // ranking already sinks those to the bottom (CLAUDE.md rule 8).
  {
    const genDate = typeof r.generatedAt === "string" ? r.generatedAt.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] : null;
    const dated = Array.isArray(r.catalysts) ? r.catalysts.map(catalystISO).filter(Boolean) : [];
    if (genDate && dated.length && dated.every((d) => d < genDate)) {
      warnings.push(`all catalysts dated in the past at generation time (generatedAt ${genDate}, latest catalyst ${dated.sort().at(-1)})`);
    }
  }

  // ── Fuzzy date without "~" (BLOCKING for new reports, WARN for the visible
  // legacy report) — see FUZZY_GRAMMAR above. dca/ is exempt: it ranks on
  // quality/valuation, never on catalyst proximity.
  if (bucket !== "dca") {
    const genDate = typeof r.generatedAt === "string" ? r.generatedAt.slice(0, 10) : "";
    const phantom = [];
    (r.catalysts ?? []).forEach((c, i) => {
      if (isPhantomFuzzy(c?.dateBadge)) phantom.push(`catalysts[${i}].dateBadge "${c.dateBadge}"`);
    });
    (r.estimateDates ?? []).forEach((e, i) => {
      if (isPhantomFuzzy(e?.dateRange)) phantom.push(`estimateDates[${i}].dateRange "${e.dateRange}"`);
    });
    if (phantom.length) {
      const msg = `fuzzy date without "~" parses to a phantom mid-period day: ${phantom.join(", ")} — write "~${phantom[0].match(/"(.*)"/)[1]}" (or the exact day if known; CLAUDE.md rule 9)`;
      const isLatest = latestByBucketTicker.get(`${bucket}:${f.split("_")[0]}`) === f;
      if (genDate >= FUZZY_RULE_SINCE) errs.push(msg);
      else if (isLatest) warnings.push(msg);
    }
  }

  // ── Scenario ordering (BLOCKING) — Bear < Base < Bull < Moon pct must hold,
  // and each price must reconcile with its own pct off the report's current
  // price (±2% tolerance for rounding). A mis-ordered or inconsistent scenario
  // means the numbers were typed independently and at least one is wrong.
  if (Array.isArray(r.scenarios) && r.scenarios.length) {
    const byLabel = new Map(r.scenarios.map((s) => [s.label, s]));
    const present = SCENARIO_ORDER.filter((l) => byLabel.has(l));
    for (let i = 1; i < present.length; i++) {
      const prev = byLabel.get(present[i - 1]), cur = byLabel.get(present[i]);
      if (typeof prev.pct === "number" && typeof cur.pct === "number" && !(prev.pct < cur.pct)) {
        errs.push(`scenarios out of order: ${present[i - 1]} pct ${prev.pct} should be < ${present[i]} pct ${cur.pct}`);
      }
    }
    {
      // Tolerance tuned to 2.5% (from the ±2% first drafted) after a full-corpus
      // run: one legitimate report rounds its Bear floor to a flat number that
      // lands at 2.25% off — real rounding, not a wrong number — while true
      // mismatches in the same corpus run 7%+ off. 2.5% keeps the real ones
      // blocked without flagging deliberate round-number floors. Checked
      // against every candidate basis (see candidateBases) — see that
      // function's comment for why more than one basis is legitimate.
      const bases = candidateBases(r);
      for (const s of r.scenarios) {
        if (typeof s.pct !== "number" || typeof s.price !== "number") continue;
        const reconciles = bases.some((b) => {
          const expected = b * (1 + s.pct / 100);
          return Math.abs(s.price - expected) <= Math.max(Math.abs(expected) * 0.025, 0.01);
        });
        if (!reconciles && bases.length) {
          const expected = bases[0] * (1 + s.pct / 100);
          errs.push(`scenarios.${s.label} price $${s.price} inconsistent with pct ${s.pct}% off current price $${bases[0]} (expected ≈$${expected.toFixed(2)})`);
        }
      }
    }
  }

  // ── Entry/TP math (BLOCKING, ±2.5% tolerance) — tp1/tp2/tp3.pct and
  // stopLoss.tight/hardPct must reconcile against SOME candidate basis (see
  // candidateBases above). A number is accepted if it matches ANY basis
  // within tolerance — only block when it matches NONE, which means the
  // price and percentage were written independently and at least one is
  // simply wrong.
  if (r.entryStrategy && typeof r.price === "number" && r.price > 0) {
    const bases = candidateBases(r);
    const matchesAnyBasis = (statedPct, targetPrice) =>
      bases.some((b) => Math.abs(((targetPrice - b) / b) * 100 - statedPct) <= 2.5);

    for (const k of ["tp1", "tp2", "tp3"]) {
      const t = r.entryStrategy[k];
      if (!t || typeof t.price !== "number" || typeof t.pct !== "number") continue;
      if (!matchesAnyBasis(t.pct, t.price)) {
        const expectedPct = ((t.price - r.price) / r.price) * 100;
        errs.push(`entryStrategy.${k}.pct ${t.pct} doesn't match price $${t.price} vs current price $${r.price} (expected ≈${expectedPct.toFixed(1)}%)`);
      }
    }
    const sl = r.entryStrategy.stopLoss;
    if (sl) {
      for (const [priceKey, pctKey] of [["tight", "tightPct"], ["hard", "hardPct"]]) {
        if (typeof sl[priceKey] !== "number" || typeof sl[pctKey] !== "number") continue;
        if (!matchesAnyBasis(sl[pctKey], sl[priceKey])) {
          const expectedPct = ((sl[priceKey] - r.price) / r.price) * 100;
          errs.push(`entryStrategy.stopLoss.${pctKey} ${sl[pctKey]} doesn't match ${priceKey} $${sl[priceKey]} vs current price $${r.price} (expected ≈${expectedPct.toFixed(1)}%)`);
        }
      }
    }
  }

  // ── Price drift vs live-prices.json (WARN) — only compared when the cache
  // has this ticker with a fresh (≤24h) asOf; never fetches over the network.
  {
    const live = LIVE_PRICES[r.ticker];
    if (live && typeof live.price === "number" && live.price > 0 && typeof live.asOf === "string" && typeof r.price === "number") {
      const asOfMs = Date.parse(live.asOf);
      if (!Number.isNaN(asOfMs) && Date.now() - asOfMs <= 24 * 3600 * 1000) {
        const driftPct = (Math.abs(r.price - live.price) / live.price) * 100;
        if (driftPct > 7) {
          warnings.push(`report price $${r.price} vs live $${live.price} (${driftPct.toFixed(1)}% drift) — research may have used a stale quote`);
        }
      }
    }
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
