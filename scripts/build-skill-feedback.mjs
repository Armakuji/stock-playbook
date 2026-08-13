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
// ── Soft targets (backlog #36) ───────────────────────────────────────────────
// The North Star bars (+30%/14d, +50%/30d) are ASPIRATIONAL: measured across
// 94 complete core windows and 36 turbo windows, hitRate was 0% in EVERY
// bucket. A metric that reads 0 everywhere carries no information — it can't
// rank catalyst types, so the "n>=5 + divergence" rule downstream could never
// fire (0 vs 0 = no divergence). These lower bars exist purely to restore
// variance to the feedback signal; they are NOT a lowering of the product
// goal, and the North Star hitRate is still reported alongside them.
const CORE_SOFT_TARGET_PCT = 10;
const TURBO_SOFT_TARGET_PCT = 20;
// A bucket is a "laggard" when its rank metric sits at least this many
// percentage points below the overall figure. Judgement call, not derived:
// ~2pp separates the visibly weak types from ordinary noise at current n.
// Revisit once n per bucket is comfortably above ~20.
const LAGGARD_MARGIN_PP = 2;
const MIN_N_FOR_RANKING = 5; // Tier-2 threshold — mirrors the n<5 guardrail
const TURBO_KEY_PREFIX = "turbo:";
const NEAR_MISS_CHECKPOINT_DAYS = 14;
const BENCH_TICKER = "SPY";
const BENCH_KEY_PREFIX = "bench:";
const DRAWDOWN_THRESHOLD_PCT = -2; // a window counts as "down" for regime notes below this

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
/** Nearest-rank percentile (p in 0..1). Null on empty input. */
function percentile(xs, p) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
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

/** SPY return over [startISO, endISO], from the shared "bench:SPY_<reportDate>"
 *  path fetched by fetch-backtest-prices.mjs (backlog #27). null if the bench
 *  path hasn't been fetched yet (e.g. before the first post-#27 backtest:fetch
 *  run) or doesn't cover the window — callers must handle that gracefully. */
function computeBenchmarkPct(pathCache, reportDate, startISO, endISO) {
  const series = (pathCache[`${BENCH_KEY_PREFIX}${BENCH_TICKER}_${reportDate}`] ?? [])
    .filter((pt) => pt.d >= startISO && pt.d <= endISO && typeof pt.c === "number")
    .sort((a, b) => a.d.localeCompare(b.d));
  if (series.length < 2) return null;
  const first = series[0].c, last = series[series.length - 1].c;
  return ((last - first) / first) * 100;
}

/** One North Star pass (shared math for core 14d/+30% and turbo 30d/+50%).
 *  Also computes the soft-target hit and excess-vs-benchmark used for ranking
 *  (backlog #36) — the North Star `hit` stays exactly as it was. */
function computeEntry({ ticker, price: p0, reportDate, pathCache, key, windowDays, targetPct, softTargetPct }) {
  const startISO = ymdToISO(reportDate);
  const endISO = addDaysISO(reportDate, windowDays);
  const elapsed = endISO <= today;
  const series = (pathCache[key] ?? [])
    .filter((pt) => pt.d >= startISO && pt.d <= endISO && typeof pt.c === "number")
    .sort((a, b) => a.d.localeCompare(b.d));

  let maxGainPct = null, maePct = null, hit = null, timeToHitDays = null, benchmarkPct = null;
  let softHit = null, excessVsBenchPct = null;
  let status;

  if (series.length === 0) {
    status = elapsed ? "no-data" : "accumulating";
  } else {
    const gains = series.map((pt) => ((pt.c - p0) / p0) * 100);
    maxGainPct = Math.max(...gains);
    maePct = Math.min(...gains, 0);
    hit = maxGainPct >= targetPct;
    softHit = maxGainPct >= softTargetPct;
    status = elapsed ? "complete" : "accumulating";
    if (hit) {
      const firstHit = series.find((pt) => ((pt.c - p0) / p0) * 100 >= targetPct);
      if (firstHit) timeToHitDays = daysBetweenISO(startISO, firstHit.d);
    }
    if (status === "complete") {
      benchmarkPct = computeBenchmarkPct(pathCache, reportDate, startISO, endISO);
      // Max gain is a best-case path stat and SPY's is a point-to-point return,
      // so this is a rough "did the pick beat just owning the index" read, not
      // a clean alpha number. Use it to ORDER buckets, not to size positions.
      if (benchmarkPct !== null) excessVsBenchPct = maxGainPct - benchmarkPct;
    }
  }

  return { ticker, reportDate, maxGainPct, maePct, hit, softHit, timeToHitDays, benchmarkPct, excessVsBenchPct, status };
}

/** Regime note for a group of (already-complete) entries: how many windows
 *  were a down-tape for the broad market, so a low hitRate can be read as
 *  "unproven in a bad regime" instead of "this type/lane doesn't work". */
function regimeNote(completeEntries) {
  const withBench = completeEntries.filter((e) => e.benchmarkPct !== null);
  if (!withBench.length) return null;
  const down = withBench.filter((e) => e.benchmarkPct <= DRAWDOWN_THRESHOLD_PCT).length;
  const majorityDown = down / withBench.length >= 0.5;
  return `${down}/${withBench.length} windows had SPY down >${Math.abs(DRAWDOWN_THRESHOLD_PCT)}%` +
    (majorityDown ? " — hit-rate measured in a drawdown regime" : "");
}

function summarize(entries) {
  const complete = entries.filter((e) => e.status === "complete");
  const hits = complete.filter((e) => e.hit);
  const softHits = complete.filter((e) => e.softHit);
  const withBench = complete.filter((e) => e.benchmarkPct !== null);
  const withExcess = complete.filter((e) => e.excessVsBenchPct !== null);
  return {
    n: complete.length,
    hitRate: complete.length ? r1((hits.length / complete.length) * 100) : null,
    // ── ranking metrics (backlog #36) — these have variance, hitRate doesn't ──
    softHitRate: complete.length ? r1((softHits.length / complete.length) * 100) : null,
    medianExcessVsBenchPct: withExcess.length ? r1(median(withExcess.map((e) => e.excessVsBenchPct))) : null,
    beatBenchRate: withExcess.length ? r1((withExcess.filter((e) => e.excessVsBenchPct > 0).length / withExcess.length) * 100) : null,
    // ────────────────────────────────────────────────────────────────────────
    medianMAE: r1(median(complete.map((e) => e.maePct).filter((v) => v !== null))),
    avgMaxGain: r1(mean(complete.map((e) => e.maxGainPct).filter((v) => v !== null))),
    medianTimeToHitDays: median(hits.map((e) => e.timeToHitDays).filter((v) => v !== null)),
    avgBenchmarkPct: withBench.length ? r1(mean(withBench.map((e) => e.benchmarkPct))) : null,
    regimeNote: regimeNote(complete),
  };
}

/** Tier-2 input, precomputed so the prompt reads a verdict instead of
 *  eyeballing a table (backlog #36). Ranks buckets on `medianExcessVsBenchPct`
 *  — the North Star `hitRate` is 0 across every bucket and therefore cannot
 *  discriminate. Falls back to `softHitRate`, then `avgMaxGain`, if the
 *  benchmark paths aren't populated yet. Only buckets with n >= 5 are eligible
 *  in either direction, so the n<5 guardrail is enforced here, not left to
 *  the model. */
function buildTier2(byType, overall) {
  const METRICS = ["medianExcessVsBenchPct", "softHitRate", "avgMaxGain"];
  const metric = METRICS.find((m) => overall[m] !== null &&
    byType.some((b) => b.n >= MIN_N_FOR_RANKING && b[m] !== null)) ?? null;

  if (!metric) {
    return {
      metric: null, fired: false, eligible: [], laggards: [], leaders: [],
      note: "No bucket has n >= 5 with a usable ranking metric yet — Tier 2 cannot fire. Treat every bucket as Tier 1 (context only).",
    };
  }

  const overallValue = overall[metric];
  const eligible = byType
    .filter((b) => b.n >= MIN_N_FOR_RANKING && b[metric] !== null)
    .map((b) => ({ type: b.type, n: b.n, value: b[metric], gapVsOverall: r1(b[metric] - overallValue), regimeNote: b.regimeNote }))
    .sort((a, b) => b.value - a.value);

  const laggards = eligible.filter((b) => b.gapVsOverall <= -LAGGARD_MARGIN_PP);
  const leaders = eligible.filter((b) => b.gapVsOverall >= LAGGARD_MARGIN_PP);

  return {
    metric,
    metricLabel: metric === "medianExcessVsBenchPct"
      ? "median (max gain − SPY over the same window), pp"
      : metric === "softHitRate" ? "% of windows that reached the soft target" : "average max gain %",
    overallValue,
    laggardMarginPP: LAGGARD_MARGIN_PP,
    minN: MIN_N_FOR_RANKING,
    fired: laggards.length > 0,
    eligible,
    laggards,
    leaders,
    note: laggards.length
      ? `Tier 2 FIRED. Picks whose primary catalystType is in \`laggards\` need visibly higher upside/conviction to make the top 5, and the screening output must name the type, its ${metric}, and the overall figure. Ranking uses ${metric} because the North Star hitRate reads 0 in every bucket and cannot discriminate. Still read each laggard's regimeNote before treating it as settled.`
      : `Tier 2 did not fire — no bucket with n >= ${MIN_N_FOR_RANKING} sits ${LAGGARD_MARGIN_PP}pp or more below overall on ${metric}. Say so explicitly in the screening output.`,
  };
}

// ── core (+30%/14d) ──────────────────────────────────────────────────────────
const pathCache = readPathCache();
const coreSnapshots = readReportSnapshots(REPORTS_DIR);
const coreEntries = coreSnapshots.map(({ report, reportDate }) =>
  ({ ...computeEntry({
      ticker: report.ticker, price: report.price, reportDate, pathCache,
      key: `${report.ticker}_${reportDate}`, windowDays: CORE_WINDOW_DAYS,
      targetPct: CORE_TARGET_PCT, softTargetPct: CORE_SOFT_TARGET_PCT,
    }),
    catalystType: primaryCatalystType(report),
    scenarios: report.scenarios ?? null,
  }));

const coreByTypeMap = {};
for (const e of coreEntries) (coreByTypeMap[e.catalystType] ??= []).push(e);
// Every catalystType we've screened gets a row — total (any status) alongside
// the complete-only n, so "still accumulating" types aren't silently dropped.
// Sorted by medianExcessVsBenchPct (falling back to softHitRate, then
// avgMaxGain): sorting by hitRate used to leave every row tied at 0.
const coreByType = Object.entries(coreByTypeMap)
  .map(([type, es]) => ({ type, total: es.length, ...summarize(es) }))
  .sort((a, b) =>
    (b.medianExcessVsBenchPct ?? b.softHitRate ?? b.avgMaxGain ?? -Infinity) -
    (a.medianExcessVsBenchPct ?? a.softHitRate ?? a.avgMaxGain ?? -Infinity));

const coreOverall = summarize(coreEntries);
const core = {
  windowDays: CORE_WINDOW_DAYS,
  targetPct: CORE_TARGET_PCT,
  softTargetPct: CORE_SOFT_TARGET_PCT,
  n: coreEntries.length,
  totalComplete: coreEntries.filter((e) => e.status === "complete").length,
  totalAccumulating: coreEntries.filter((e) => e.status === "accumulating").length,
  overall: coreOverall,
  byType: coreByType,
  tier2: buildTier2(coreByType, coreOverall),
};

// ── turbo (+50%/30d) ─────────────────────────────────────────────────────────
const turboSnapshots = readReportSnapshots(SPECULATIVE_DIR);
const turboEntries = turboSnapshots.map(({ report, reportDate }) =>
  ({ ...computeEntry({
      ticker: report.ticker, price: report.price, reportDate, pathCache,
      key: `${TURBO_KEY_PREFIX}${report.ticker}_${reportDate}`, windowDays: TURBO_WINDOW_DAYS,
      targetPct: TURBO_TARGET_PCT, softTargetPct: TURBO_SOFT_TARGET_PCT,
    }),
    scenarios: report.scenarios ?? null,
  }));

const turbo = {
  windowDays: TURBO_WINDOW_DAYS,
  targetPct: TURBO_TARGET_PCT,
  softTargetPct: TURBO_SOFT_TARGET_PCT,
  n: turboEntries.length,
  totalComplete: turboEntries.filter((e) => e.status === "complete").length,
  totalAccumulating: turboEntries.filter((e) => e.status === "accumulating").length,
  overall: summarize(turboEntries),
};

// ── regime (top-level, backlog #27) ──────────────────────────────────────────
// Median SPY return across every complete window (core + turbo combined) —
// read alongside hitRate: a 0% hit-rate during a deeply negative benchmark
// stretch means "unproven in a bad regime", not "this type/lane is bad".
// null (not 0) when no complete entry has bench data yet — e.g. right after
// this feature ships, before the first backtest:fetch populates bench: keys.
const allCompleteForRegime = [...coreEntries, ...turboEntries].filter(
  (e) => e.status === "complete" && e.benchmarkPct !== null,
);
const regime = {
  n: allCompleteForRegime.length,
  medianBenchmarkPct: allCompleteForRegime.length ? r1(median(allCompleteForRegime.map((e) => e.benchmarkPct))) : null,
  note: "SPY return over the same window as each complete entry (core+turbo combined). Pair with core.overall.regimeNote / core.byType[].regimeNote / turbo.overall.regimeNote before judging a hitRate — a low hitRate in a down-tape window is unproven, not disproven.",
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
  // Realized distribution (backlog #36) — a single median gives the model
  // nothing to aim at, so expose the shape it should be writing against.
  realizedMaxGainP75Pct: r1(percentile(realized, 0.75)),
  realizedMaxGainP90Pct: r1(percentile(realized, 0.90)),
  optimismBiasBasePct: (medianWrittenBase != null && medianRealized != null) ? r1(medianWrittenBase - medianRealized) : null,
  optimismBiasBullPct: (medianWrittenBull != null && medianRealized != null) ? r1(medianWrittenBull - medianRealized) : null,
  note: "optimismBias = written scenario % − realized max gain % over the same completed window. Positive = we write more optimistic scenarios than what actually happened.",
  horizonCaveat:
    `HORIZON MISMATCH — read before acting on this. Realized figures are measured over the ` +
    `${CORE_WINDOW_DAYS}d (core) / ${TURBO_WINDOW_DAYS}d (turbo) North Star window, while a written ` +
    `Base/Bull scenario usually implies a longer horizon. So a positive optimismBias is NOT proof ` +
    `the scenario was wrong — it may just be a longer clock. That is exactly why the rule below is ` +
    `"declare and justify", not "cap".`,
  rule:
    `Every report must (a) state the measured optimismBias it was written against, and (b) if the ` +
    `written Base exceeds realizedMaxGainP75Pct, name the horizon that Base assumes and the specific ` +
    `driver that gets it there. A Base above realizedMaxGainP90Pct with no stated horizon is not ` +
    `acceptable — that is the failure mode this field exists to catch.`,
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

// ── stop guidance (backlog #36) ──────────────────────────────────────────────
// Measured MAE vs the stop widths the report template actually writes. A stop
// tighter than the median drawdown stops out the median pick before the thesis
// has had a chance to play out — this block makes that a checkable number
// rather than a feel.
const stopGuidance = {
  coreMedianMAEPct: core.overall.medianMAE,
  turboMedianMAEPct: turbo.overall.medianMAE,
  rule:
    `entryStrategy.stopLoss.tight must sit WIDER than the relevant medianMAE (use ` +
    `core.byType[].medianMAE for the pick's catalystType when that bucket has n >= ${MIN_N_FOR_RANKING}, ` +
    `otherwise core.overall.medianMAE / turbo.overall.medianMAE), or the report must say in one line ` +
    `why this specific setup justifies a tighter stop. Same number informs ` +
    `catalystSpot.stopPreCatalyst and spotSizing.`,
  caveat:
    `MAE here is measured from the REPORT price, so it assumes entry at Entry 1 (now). A pick filled ` +
    `on the Entry 2 dip has a structurally shallower drawdown from its own fill — don't apply the ` +
    `full width mechanically to a dip entry.`,
};

// ── write ─────────────────────────────────────────────────────────────────
const feedback = {
  generatedAt: new Date().toISOString(),
  windowNote:
    `core = +${CORE_TARGET_PCT}% within ${CORE_WINDOW_DAYS} days of report price (catalyst plays) · ` +
    `turbo = +${TURBO_TARGET_PCT}% within ${TURBO_WINDOW_DAYS} days (moonshot plays) · ` +
    `MAE = max adverse excursion (worst drawdown before target hit, or over the window if never hit) · ` +
    `SOFT TARGETS (backlog #36): North Star hitRate currently reads 0% in EVERY bucket, so it cannot ` +
    `rank anything. softHitRate (+${CORE_SOFT_TARGET_PCT}% core / +${TURBO_SOFT_TARGET_PCT}% turbo), ` +
    `medianExcessVsBenchPct and beatBenchRate are the metrics that discriminate — rank on those, and ` +
    `keep reporting hitRate as the honest scoreboard against the stated goal. · ` +
    `GUARDRAIL (2-tier, backlog #27): n < ${MIN_N_FOR_RANKING} in a bucket = context only, NEVER a ` +
    `reason to include/exclude/re-rank a pick. n >= ${MIN_N_FOR_RANKING} = MUST be applied — but do ` +
    `NOT re-derive this by eye: read \`core.tier2\`, which precomputes the eligible buckets, the ` +
    `laggards, and whether the rule fired. Screening output must state the tier2 verdict either way. · ` +
    `REGIME CAVEAT (both tiers): always read any rate next to avgBenchmarkPct/regimeNote — a 0% ` +
    `hit-rate measured in a deeply negative SPY window means "unproven in a bad regime", not "this ` +
    `type doesn't work". Check the actual regimeNote text each run; SPY does not see a sector-only ` +
    `selloff, a known gap in this rough v1 signal.`,
  core,
  turbo,
  regime,
  scenarioCalibration,
  stopGuidance,
  nearMissCounterfactual,
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(feedback, null, 2));

console.log(`📊 core: n=${core.n} (${core.totalComplete} complete, ${core.totalAccumulating} accumulating) · ${core.byType.length} catalyst type(s) · hitRate ${core.overall.hitRate}% · softHitRate ${core.overall.softHitRate}% (+${CORE_SOFT_TARGET_PCT}%) · beatBench ${core.overall.beatBenchRate}% · regimeNote: ${core.overall.regimeNote ?? "no bench data yet"}`);
console.log(`🎯 tier2: ${core.tier2.fired ? `FIRED on ${core.tier2.metric} — laggards: ${core.tier2.laggards.map((l) => `${l.type} (${l.value}, ${l.gapVsOverall}pp vs overall ${core.tier2.overallValue}, n=${l.n})`).join(", ")}` : `not fired (${core.tier2.metric ?? "no usable metric"})`}`);
console.log(`🎰 turbo: n=${turbo.n} (${turbo.totalComplete} complete, ${turbo.totalAccumulating} accumulating) · hitRate ${turbo.overall.hitRate}% · softHitRate ${turbo.overall.softHitRate}% (+${TURBO_SOFT_TARGET_PCT}%) · regimeNote: ${turbo.overall.regimeNote ?? "no bench data yet"}`);
console.log(`🛑 stops: core medianMAE ${stopGuidance.coreMedianMAEPct}% · turbo medianMAE ${stopGuidance.turboMedianMAEPct}% — tight stops must be wider than these`);
console.log(`🌐 regime: n=${regime.n} · median SPY over completed windows: ${regime.medianBenchmarkPct ?? "no data yet"}${regime.medianBenchmarkPct != null ? "%" : ""}`);
console.log(`📐 scenario calibration: n=${scenarioCalibration.n}`);
console.log(`🕵️ near-miss counterfactual · core: ${nearMissCounterfactual.core ? `n=${nearMissCounterfactual.core.n}` : "null (no data yet)"} · turbo: ${nearMissCounterfactual.turbo ? `n=${nearMissCounterfactual.turbo.n}` : "null (no data yet)"}`);
console.log(`✅ skill feedback written → web/data/skill-feedback.json`);
