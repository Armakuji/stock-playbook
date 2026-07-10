#!/usr/bin/env node
// ─── build-skill-feedback.mjs — closes the skill feedback loop (backlog #25) ─
// Distills path-cache.json + backtest-cache.json + near-misses.json + report
// JSONs into a compact web/data/skill-feedback.json — a lessons file that
// gets pasted into Claude's context during /catalyst-list, /turbo-list, and
// /analyze screening so picks are advised by real measured results instead
// of pure vibes.
//
// This is a plain .mjs script (no TS type-checking, runs standalone or
// chained after `npm run backtest:fetch`), while the North Star math it
// mirrors lives in web/lib/north-star.ts and web/lib/turbo-north-star.ts
// (TypeScript, used by the /backtest page). The core computation — window,
// target %, hit/MAE/time-to-hit — is intentionally DUPLICATED here in plain
// JS rather than imported, since Node can't import .ts without a build step.
// If you change the North Star math, update BOTH places.
//
//   Run:  node scripts/build-skill-feedback.mjs
//   Chained automatically by:  npm run backtest:fetch  (in web/package.json)
//
// ⚠️ GUARDRAIL: every aggregate below carries an `n`. Any consumer (SKILL.md /
// command prompts) MUST treat n < 5 as context-only — never a reason to
// include/exclude/re-rank a pick. See IMPROVEMENT_BACKLOG.md #25.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REPORTS_DIR = path.join(ROOT, "web", "data", "reports");
const SPECULATIVE_DIR = path.join(ROOT, "web", "data", "speculative");
const PATH_CACHE_FILE = path.join(ROOT, "web", "data", "path-cache.json");
const BACKTEST_CACHE_FILE = path.join(ROOT, "web", "data", "backtest-cache.json");
const NEAR_MISS_FILE = path.join(ROOT, "web", "data", "near-misses.json");
const OUT_FILE = path.join(ROOT, "web", "data", "skill-feedback.json");

const CORE_WINDOW_DAYS = 14;
const CORE_TARGET_PCT = 30;
const TURBO_WINDOW_DAYS = 30;
const TURBO_TARGET_PCT = 50;
const TURBO_KEY_PREFIX = "turbo:";
const NEAR_MISS_CHECKPOINT_DAYS = 14;

const today = new Date().toISOString().slice(0, 10);

// ── shared helpers (mirrors web/lib/north-star.ts) ──────────────────────────
function ymdToISO(s) { return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; }
function addDaysISO(yyyymmdd, days) {
  const y = +yyyymmdd.slice(0, 4), m = +yyyymmdd.slice(4, 6) - 1, d = +yyyymmdd.slice(6, 8);
  const dt = new Date(y, m, d); dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}
function daysBetweenISO(fromISO, toISO) {
  const from = new Date(fromISO + "T00:00:00Z").getTime();
  const to = new Date(toISO + "T00:00:00Z").getTime();
  return Math.round((to - from) / 86400000);
}
function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function mean(xs) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
}
/** Round to 1dp and guard against NaN/Infinity leaking into the JSON. */
function r1(x) {
  if (x == null || !Number.isFinite(x)) return null;
  return Math.round(x * 10) / 10;
}

// Mirrors web/lib/catalyst-timing.ts primaryCatalystType() — pure string
// parsing, no need for the full TS module.
function primaryCatalystType(report) {
  const raw = report?.catalystSpot?.catalystType;
  if (!raw) return "other";
  const first = String(raw).split(/[+,/]/)[0].trim().toLowerCase().replace(/\s+/g, "_");
  return first || "other";
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf-8")); } catch { return fallback; }
}

function readPathCache() {
  const j = readJSON(PATH_CACHE_FILE, {});
  delete j._note;
  return j;
}

function readReportSnapshots(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const m = f.match(/_(\d{8})\.json$/);
    if (!m) continue;
    const rep = readJSON(path.join(dir, f), null);
    if (!rep?.ticker || !rep.price) continue;
    out.push({ report: rep, reportDate: m[1] });
  }
  return out;
}

/** One North Star pass (shared math for core 14d/+30% and turbo 30d/+50%). */
function computeEntry({ ticker, price: p0, reportDate, pathCache, key, windowDays, targetPct }) {
  const startISO = ymdToISO(reportDate);
  const endISO = addDaysISO(reportDate, windowDays);
  const elapsed = endISO <= today;
  const series = (pathCache[key] ?? [])
    .filter((pt) => pt.d >= startISO && pt.d <= endISO && typeof pt.c === "number")
    .sort((a, b) => a.d.localeCompare(b.d));

  let maxGainPct = null, maePct = null, hit = null, timeToHitDays = null;
  let status;

  if (series.length === 0) {
    status = elapsed ? "no-data" : "accumulating";
  } else {
    const gains = series.map((pt) => ((pt.c - p0) / p0) * 100);
    maxGainPct = Math.max(...gains);
    maePct = Math.min(...gains, 0);
    hit = maxGainPct >= targetPct;
    status = elapsed ? "complete" : "accumulating";
    if (hit) {
      const firstHit = series.find((pt) => ((pt.c - p0) / p0) * 100 >= targetPct);
      if (firstHit) timeToHitDays = daysBetweenISO(startISO, firstHit.d);
    }
  }

  return { ticker, reportDate, maxGainPct, maePct, hit, timeToHitDays, status };
}

function summarize(entries) {
  const complete = entries.filter((e) => e.status === "complete");
  const hits = complete.filter((e) => e.hit);
  return {
    n: complete.length,
    hitRate: complete.length ? r1((hits.length / complete.length) * 100) : null,
    medianMAE: r1(median(complete.map((e) => e.maePct).filter((v) => v !== null))),
    avgMaxGain: r1(mean(complete.map((e) => e.maxGainPct).filter((v) => v !== null))),
    medianTimeToHitDays: median(hits.map((e) => e.timeToHitDays).filter((v) => v !== null)),
  };
}

// ── core (+30%/14d) ──────────────────────────────────────────────────────────
const pathCache = readPathCache();
const coreSnapshots = readReportSnapshots(REPORTS_DIR);
const coreEntries = coreSnapshots.map(({ report, reportDate }) =>
  ({ ...computeEntry({
      ticker: report.ticker, price: report.price, reportDate, pathCache,
      key: `${report.ticker}_${reportDate}`, windowDays: CORE_WINDOW_DAYS, targetPct: CORE_TARGET_PCT,
    }),
    catalystType: primaryCatalystType(report),
    scenarios: report.scenarios ?? null,
  }));

const coreByTypeMap = {};
for (const e of coreEntries) (coreByTypeMap[e.catalystType] ??= []).push(e);
// Every catalystType we've screened gets a row — total (any status) alongside
// the complete-only n, so "still accumulating" types aren't silently dropped.
const coreByType = Object.entries(coreByTypeMap)
  .map(([type, es]) => ({ type, total: es.length, ...summarize(es) }))
  .sort((a, b) => (b.hitRate ?? -1) - (a.hitRate ?? -1));

const core = {
  windowDays: CORE_WINDOW_DAYS,
  targetPct: CORE_TARGET_PCT,
  n: coreEntries.length,
  totalComplete: coreEntries.filter((e) => e.status === "complete").length,
  totalAccumulating: coreEntries.filter((e) => e.status === "accumulating").length,
  overall: summarize(coreEntries),
  byType: coreByType,
};

// ── turbo (+50%/30d) ─────────────────────────────────────────────────────────
const turboSnapshots = readReportSnapshots(SPECULATIVE_DIR);
const turboEntries = turboSnapshots.map(({ report, reportDate }) =>
  ({ ...computeEntry({
      ticker: report.ticker, price: report.price, reportDate, pathCache,
      key: `${TURBO_KEY_PREFIX}${report.ticker}_${reportDate}`, windowDays: TURBO_WINDOW_DAYS, targetPct: TURBO_TARGET_PCT,
    }),
    scenarios: report.scenarios ?? null,
  }));

const turbo = {
  windowDays: TURBO_WINDOW_DAYS,
  targetPct: TURBO_TARGET_PCT,
  n: turboEntries.length,
  totalComplete: turboEntries.filter((e) => e.status === "complete").length,
  totalAccumulating: turboEntries.filter((e) => e.status === "accumulating").length,
  overall: summarize(turboEntries),
};

// ── scenario calibration (written Base/Bull vs realized maxGainPct) ─────────
// Over every COMPLETE entry (core + turbo) that has a Base/Bull scenario written.
const calibrationSource = [...coreEntries, ...turboEntries].filter(
  (e) => e.status === "complete" && e.maxGainPct !== null && Array.isArray(e.scenarios),
);
const writtenBase = [], writtenBull = [], realized = [];
for (const e of calibrationSource) {
  const base = e.scenarios.find((s) => s.label === "Base");
  const bull = e.scenarios.find((s) => s.label === "Bull");
  if (base) { writtenBase.push(base.pct); realized.push(e.maxGainPct); }
  if (bull) { writtenBull.push(bull.pct); }
}
const medianRealized = median(realized);
const medianWrittenBase = median(writtenBase);
const medianWrittenBull = median(writtenBull);

const scenarioCalibration = {
  n: calibrationSource.length,
  medianWrittenBasePct: r1(medianWrittenBase),
  medianWrittenBullPct: r1(medianWrittenBull),
  medianRealizedMaxGainPct: r1(medianRealized),
  optimismBiasBasePct: (medianWrittenBase != null && medianRealized != null) ? r1(medianWrittenBase - medianRealized) : null,
  optimismBiasBullPct: (medianWrittenBull != null && medianRealized != null) ? r1(medianWrittenBull - medianRealized) : null,
  note: "optimismBias = written scenario % − realized max gain % over the same completed window. Positive = we write more optimistic scenarios than what actually happened.",
};

// ── near-miss counterfactual (did the top-5 cut add alpha?) — per lane ──────
// near-miss side: point-in-time actual % (checkpointDays out) from backtest-cache.json.
// picked side: max gain WITHIN the same window from North Star (more favorable
// to picks by construction — not a perfectly matched methodology, noted below).
// lane "core" compares at 14d vs core picks; lane "turbo" compares at 30d vs
// turbo picks. Entries with no `lane` field predate the split and default to "core".
const backtestCache = readJSON(BACKTEST_CACHE_FILE, {});
const nearMissRaw = readJSON(NEAR_MISS_FILE, { nearMisses: [] }).nearMisses ?? [];

function nearMissPctsForLane(lane, checkpointDays) {
  const out = [];
  for (const raw of nearMissRaw) {
    if ((raw.lane ?? "core") !== lane) continue;
    const ticker = raw.ticker;
    const screenDate = raw.screenDate ?? (raw.date ? raw.date.replace(/-/g, "") : undefined);
    const screenPrice = raw.screenPrice ?? raw.priceAtScreen ?? null;
    if (!ticker || !screenDate || !screenPrice) continue;
    const targetDate = addDaysISO(screenDate, checkpointDays);
    if (targetDate > today) continue;
    const cached = backtestCache[`${ticker}_${targetDate}`];
    if (!cached?.price) continue;
    out.push(((cached.price - screenPrice) / screenPrice) * 100);
  }
  return out;
}

function buildCounterfactual(lane, checkpointDays, pickedPcts) {
  const nmPcts = nearMissPctsForLane(lane, checkpointDays);
  if (nmPcts.length === 0) return null;
  const medianNM = median(nmPcts);
  const medianPicked = median(pickedPcts);
  return {
    n: nmPcts.length,
    pickedN: pickedPcts.length,
    windowDays: checkpointDays,
    medianNearMissPct: r1(medianNM),
    medianPickedMaxGainPct: r1(medianPicked),
    selectionEdgePct: (medianPicked != null && medianNM != null) ? r1(medianPicked - medianNM) : null,
    note: `Not perfectly apples-to-apples: near-miss uses point-in-time +${checkpointDays}d price; picks use max gain within the ${checkpointDays}d window (structurally favors picks). Treat edge as an upper bound, not exact.`,
  };
}

const pickedMaxGain14dCore = coreEntries.filter((e) => e.status === "complete" && e.maxGainPct !== null).map((e) => e.maxGainPct);
const pickedMaxGain30dTurbo = turboEntries.filter((e) => e.status === "complete" && e.maxGainPct !== null).map((e) => e.maxGainPct);

const nearMissCounterfactual = {
  core: buildCounterfactual("core", NEAR_MISS_CHECKPOINT_DAYS, pickedMaxGain14dCore),
  turbo: buildCounterfactual("turbo", TURBO_WINDOW_DAYS, pickedMaxGain30dTurbo),
};

// ── write ─────────────────────────────────────────────────────────────────
const feedback = {
  generatedAt: new Date().toISOString(),
  windowNote:
    `core = +${CORE_TARGET_PCT}% within ${CORE_WINDOW_DAYS} days of report price (catalyst plays) · ` +
    `turbo = +${TURBO_TARGET_PCT}% within ${TURBO_WINDOW_DAYS} days (moonshot plays) · ` +
    `MAE = max adverse excursion (worst drawdown before target hit, or over the window if never hit) · ` +
    `GUARDRAIL: n < 5 in any bucket = context only, NEVER a reason to include/exclude/re-rank a pick.`,
  core,
  turbo,
  scenarioCalibration,
  nearMissCounterfactual,
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(feedback, null, 2));

console.log(`📊 core: n=${core.n} (${core.totalComplete} complete, ${core.totalAccumulating} accumulating) · ${core.byType.length} catalyst type(s)`);
console.log(`🎰 turbo: n=${turbo.n} (${turbo.totalComplete} complete, ${turbo.totalAccumulating} accumulating)`);
console.log(`📐 scenario calibration: n=${scenarioCalibration.n}`);
console.log(`🕵️ near-miss counterfactual · core: ${nearMissCounterfactual.core ? `n=${nearMissCounterfactual.core.n}` : "null (no data yet)"} · turbo: ${nearMissCounterfactual.turbo ? `n=${nearMissCounterfactual.turbo.n}` : "null (no data yet)"}`);
console.log(`✅ skill feedback written → web/data/skill-feedback.json`);
