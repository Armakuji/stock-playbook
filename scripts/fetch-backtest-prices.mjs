#!/usr/bin/env node
// ─── fetch-backtest-prices.mjs — closes the backtest feedback loop ───────────
// Scans web/data/reports/*.json, computes 30/60/90-day checkpoints that are
// already in the past, fetches the historical close from Yahoo Finance for
// each, and writes web/data/backtest-cache.json (the exact shape that
// web/lib/backtest.ts reads). After running, the /backtest page shows real
// hit/miss instead of "pending" — so you can finally measure whether your
// BUY/SPECULATIVE verdicts actually worked.
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
const CACHE_FILE = path.join(ROOT, "web", "data", "backtest-cache.json");
const NEAR_MISS_FILE = path.join(ROOT, "web", "data", "near-misses.json");
const CHECKPOINTS = [30, 60, 90];
const NEAR_MISS_CHECKPOINTS = [14, 30];

// ── must produce IDENTICAL keys to web/lib/backtest.ts ──────────────────────
function addDays(dateStr, days) {              // dateStr "YYYYMMDD" → "YYYY-MM-DD"
  const y = +dateStr.slice(0, 4);
  const m = +dateStr.slice(4, 6) - 1;
  const d = +dateStr.slice(6, 8);
  const dt = new Date(y, m, d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}
const cacheKey = (ticker, date) => `${ticker}_${date}`;

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

function collectPastTargets() {
  if (!fs.existsSync(REPORTS_DIR)) return [];
  const out = new Map(); // key → { ticker, date }
  for (const f of fs.readdirSync(REPORTS_DIR).filter((x) => x.endsWith(".json"))) {
    const m = f.match(/_(\d{8})\.json$/);
    if (!m) continue;
    let rep;
    try { rep = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), "utf-8")); } catch { continue; }
    if (!rep?.ticker) continue;
    for (const days of CHECKPOINTS) {
      const targetDate = addDays(m[1], days);
      if (targetDate > today) continue;        // future checkpoint — not measurable yet
      out.set(cacheKey(rep.ticker, targetDate), { ticker: rep.ticker, date: targetDate });
    }
  }
  return [...out.values()];
}

// Near-miss outcome dates (screenDate + 14/30d) so the counterfactual log fills too.
function collectNearMissTargets() {
  if (!fs.existsSync(NEAR_MISS_FILE)) return [];
  let nm;
  try { nm = JSON.parse(fs.readFileSync(NEAR_MISS_FILE, "utf-8")).nearMisses ?? []; } catch { return []; }
  const out = new Map();
  for (const m of nm) {
    if (!m.ticker || !m.screenDate) continue;
    for (const days of NEAR_MISS_CHECKPOINTS) {
      const targetDate = addDays(m.screenDate, days);
      if (targetDate > today) continue;
      out.set(cacheKey(m.ticker, targetDate), { ticker: m.ticker, date: targetDate });
    }
  }
  return [...out.values()];
}

const cache = readCache();
const merged = new Map();
for (const t of [...collectPastTargets(), ...collectNearMissTargets()]) merged.set(cacheKey(t.ticker, t.date), t);
const targets = [...merged.values()];
const todo = targets.filter((t) => !cache[cacheKey(t.ticker, t.date)]);

console.log(`📊 ${targets.length} past checkpoint(s) · ${todo.length} to fetch · ${targets.length - todo.length} cached`);

let ok = 0, fail = 0;
for (const { ticker, date } of todo) {
  const price = await fetchClose(ticker, date);
  if (price != null) {
    cache[cacheKey(ticker, date)] = { price: +price.toFixed(2), fetchedAt: new Date().toISOString() };
    ok++; console.log(`  ✓ ${ticker} @ ${date} → $${price.toFixed(2)}`);
  } else {
    fail++; console.log(`  ✗ ${ticker} @ ${date} → no data`);
  }
  await new Promise((r) => setTimeout(r, 250)); // be gentle to Yahoo
}

writeCache(cache);
console.log(`✅ done · ${ok} fetched · ${fail} failed · → web/data/backtest-cache.json`);
