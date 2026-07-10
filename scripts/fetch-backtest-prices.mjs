#!/usr/bin/env node
// ─── fetch-backtest-prices.mjs — closes the backtest feedback loop ───────────
// Scans web/data/reports/*.json, computes 30/60/90-day checkpoints that are
// already in the past, fetches the historical close from Yahoo Finance for
// each, and writes web/data/backtest-cache.json (the exact shape that
// web/lib/backtest.ts reads). After running, the /backtest page shows real
// hit/miss instead of "pending" — so you can finally measure whether your
// BUY/SELL/SPECULATIVE verdicts actually worked.
//
// Also scans web/data/speculative/*.json (turbo moonshot reports) the same
// way, but namespaces every cache key with a "turbo:" prefix so a ticker+date
// that exists in both reports/ and speculative/ can't collide — core keys are
// UNCHANGED (must stay identical to what web/lib/backtest.ts / north-star.ts
// read). Turbo also gets its own 30-day price path (vs. core's 14) to feed
// web/lib/turbo-north-star.ts ("+50% within 30 days").
//
//   Run:  node scripts/fetch-backtest-prices.mjs
//   Safe to re-run — already-cached keys are skipped.
//   Schedule it (e.g. daily) to keep the loop closed automatically.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REPORTS_DIR = path.join(ROOT, "web", "data", "reports");
const SPECULATIVE_DIR = path.join(ROOT, "web", "data", "speculative");
const CACHE_FILE = path.join(ROOT, "web", "data", "backtest-cache.json");
const NEAR_MISS_FILE = path.join(ROOT, "web", "data", "near-misses.json");
const PATH_CACHE_FILE = path.join(ROOT, "web", "data", "path-cache.json");
const CHECKPOINTS = [30, 60, 90];
const NEAR_MISS_CHECKPOINTS = [14, 30];
const NS_WINDOW = 14;          // core North Star: +30% within 14 days
const TURBO_NS_WINDOW = 30;    // turbo North Star: +50% within 30 days
const TURBO_KEY_PREFIX = "turbo:";

// ── must produce IDENTICAL keys to web/lib/backtest.ts ──────────────────────
export function addDays(dateStr, days) {              // dateStr "YYYYMMDD" → "YYYY-MM-DD"
  const y = +dateStr.slice(0, 4);
  const m = +dateStr.slice(4, 6) - 1;
  const d = +dateStr.slice(6, 8);
  const dt = new Date(y, m, d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}
export const cacheKey = (ticker, date) => `${ticker}_${date}`;
export const turboCacheKey = (ticker, date) => `${TURBO_KEY_PREFIX}${cacheKey(ticker, date)}`;

function readCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")); } catch { return {}; }
}
function writeCache(c) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(c, null, 2));
}

// ── Yahoo Finance historical close (closest trading day to the target) ──────
async function fetchClose(ticker, date) {
  const dt = new Date(date + "T12:00:00Z");
  const target = Math.floor(dt.getTime() / 1000);
  const p1 = target - 4 * 86400;   // widen ±4d to span weekends/holidays
  const p2 = target + 4 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${p1}&period2=${p2}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const ts = result?.timestamp;
    const closes = result?.indicators?.quote?.[0]?.close;
    if (!ts || !closes) return null;
    let best = null, bestDiff = Infinity;
    for (let i = 0; i < ts.length; i++) {
      if (closes[i] == null) continue;
      const diff = Math.abs(ts[i] - target);
      if (diff < bestDiff) { bestDiff = diff; best = closes[i]; }
    }
    return best;
  } catch { return null; }
}

const today = new Date().toISOString().slice(0, 10);

/** Scan `dir` for <TICKER>_<YYYYMMDD>.json report snapshots and produce every
 *  past (already-reachable) 30/60/90d checkpoint target, keyed via `keyFn`. */
export function collectCheckpointTargets(dir, keyFn) {
  if (!fs.existsSync(dir)) return [];
  const out = new Map(); // key → { key, ticker, date }
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const m = f.match(/_(\d{8})\.json$/);
    if (!m) continue;
    let rep;
    try { rep = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")); } catch { continue; }
    if (!rep?.ticker) continue;
    for (const days of CHECKPOINTS) {
      const targetDate = addDays(m[1], days);
      if (targetDate > today) continue;        // future checkpoint — not measurable yet
      const key = keyFn(rep.ticker, targetDate);
      out.set(key, { key, ticker: rep.ticker, date: targetDate });
    }
  }
  return [...out.values()];
}

// Near-miss outcome dates (screenDate + 14/30d) so the counterfactual log fills too.
export function collectNearMissTargets() {
  if (!fs.existsSync(NEAR_MISS_FILE)) return [];
  let nm;
  try { nm = JSON.parse(fs.readFileSync(NEAR_MISS_FILE, "utf-8")).nearMisses ?? []; } catch { return []; }
  const out = new Map();
  for (const raw of nm) {
    // Bug fix: near-misses.json stores the legacy field "date" (e.g. "2026-06-23"),
    // never "screenDate" — every entry was silently skipped (0 targets, always).
    // Mirrors the same normalization web/lib/near-miss.ts's readNearMisses() does.
    const ticker = raw.ticker;
    const screenDate = raw.screenDate ?? (raw.date ? raw.date.replace(/-/g, "") : undefined);
    if (!ticker || !screenDate) continue;
    for (const days of NEAR_MISS_CHECKPOINTS) {
      const targetDate = addDays(screenDate, days);
      if (targetDate > today) continue;
      const key = cacheKey(ticker, targetDate);
      out.set(key, { key, ticker, date: targetDate });
    }
  }
  return [...out.values()];
}

// ── North Star: fetch the daily price path per report snapshot ──────────────
const ymdToISO = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

function readPathCache() {
  try { const j = JSON.parse(fs.readFileSync(PATH_CACHE_FILE, "utf-8")); return j; } catch { return { _note: "" }; }
}

async function fetchPath(ticker, fromISO, toISO) {
  const p1 = Math.floor(new Date(fromISO + "T00:00:00Z").getTime() / 1000) - 86400;
  const p2 = Math.floor(new Date(toISO + "T00:00:00Z").getTime() / 1000) + 2 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${p1}&period2=${p2}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.chart?.result?.[0];
    const ts = r?.timestamp, closes = r?.indicators?.quote?.[0]?.close;
    if (!ts || !closes) return null;
    const out = [];
    for (let i = 0; i < ts.length; i++) {
      if (closes[i] == null) continue;
      out.push({ d: new Date(ts[i] * 1000).toISOString().slice(0, 10), c: +closes[i].toFixed(2) });
    }
    return out;
  } catch { return null; }
}

/** Scan `dir` for report snapshots and produce one path-fetch job per ticker,
 *  windowed to `windowDays` and keyed via `keyFn`. */
export function collectPathSnapshots(dir, windowDays, keyFn) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((x) => x.endsWith(".json")).map((f) => {
    const m = f.match(/_(\d{8})\.json$/);
    if (!m) return null;
    let ticker;
    try { ticker = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")).ticker; }
    catch { return null; }
    if (!ticker) return null;
    return { ticker, reportDate: m[1], windowDays, key: keyFn(ticker, m[1]) };
  }).filter(Boolean);
}

async function main() {
  const cache = readCache();
  const coreTargets = collectCheckpointTargets(REPORTS_DIR, cacheKey);
  const turboTargets = collectCheckpointTargets(SPECULATIVE_DIR, turboCacheKey);
  const nearMissTargets = collectNearMissTargets();

  const merged = new Map();
  for (const t of [...coreTargets, ...turboTargets, ...nearMissTargets]) merged.set(t.key, t);
  const targets = [...merged.values()];
  const todo = targets.filter((t) => !cache[t.key]);

  console.log(`📊 core: ${coreTargets.length} checkpoint(s) · turbo: ${turboTargets.length} checkpoint(s) · near-miss: ${nearMissTargets.length} · ${todo.length} to fetch · ${targets.length - todo.length} cached`);

  let ok = 0, fail = 0;
  for (const { key, ticker, date } of todo) {
    const price = await fetchClose(ticker, date);
    if (price != null) {
      cache[key] = { price: +price.toFixed(2), fetchedAt: new Date().toISOString() };
      ok++; console.log(`  ✓ ${key} → $${price.toFixed(2)}`);
    } else {
      fail++; console.log(`  ✗ ${key} → no data`);
    }
    await new Promise((r) => setTimeout(r, 250)); // be gentle to Yahoo
  }

  writeCache(cache);
  console.log(`✅ checkpoints done · ${ok} fetched · ${fail} failed · → web/data/backtest-cache.json`);

  const pathCache = readPathCache();
  let pathOk = 0, pathSkip = 0;

  const corePaths = collectPathSnapshots(REPORTS_DIR, NS_WINDOW, (ticker, reportDate) => `${ticker}_${reportDate}`);
  const turboPaths = collectPathSnapshots(SPECULATIVE_DIR, TURBO_NS_WINDOW, (ticker, reportDate) => turboCacheKey(ticker, reportDate));
  console.log(`⌁ core: ${corePaths.length} snapshot(s) (${NS_WINDOW}d window) · turbo: ${turboPaths.length} snapshot(s) (${TURBO_NS_WINDOW}d window)`);

  for (const { ticker, reportDate, windowDays, key } of [...corePaths, ...turboPaths]) {
    const startISO = ymdToISO(reportDate);
    const endISO = addDays(reportDate, windowDays);
    if (startISO > today) continue;                         // window not started
    const existing = pathCache[key];
    const lastHave = Array.isArray(existing) && existing.length ? existing[existing.length - 1].d : null;
    if (lastHave && (lastHave >= endISO || lastHave >= today)) { pathSkip++; continue; } // already complete / current
    const p = await fetchPath(ticker, startISO, endISO);
    if (p && p.length) { pathCache[key] = p; pathOk++; console.log(`  ⌁ ${key} path ${startISO}→${endISO} (${p.length}d)`); }
    await new Promise((r) => setTimeout(r, 250));
  }

  fs.writeFileSync(PATH_CACHE_FILE, JSON.stringify(pathCache, null, 2));
  console.log(`✅ paths done · ${pathOk} fetched · ${pathSkip} already complete · → web/data/path-cache.json`);
}

// Only run when invoked directly (`node scripts/fetch-backtest-prices.mjs`) —
// importing this module (e.g. from a verification script) must not trigger
// network calls or file writes as a side effect.
if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}

export { REPORTS_DIR, SPECULATIVE_DIR, TURBO_KEY_PREFIX, NS_WINDOW, TURBO_NS_WINDOW, CHECKPOINTS };
