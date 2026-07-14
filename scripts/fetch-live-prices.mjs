#!/usr/bin/env node
// ─── fetch-live-prices.mjs — one shared live-price cache for the compare skills ──
// Both catalyst-compare and turbo-compare need a current price for every ticker
// on the dashboard, but report prices can be up to ~2 weeks stale and having the
// agent fetch 22–24 tickers itself every compare run is slow and heavy. This
// script does it once: scan every report snapshot (core + turbo + dca), fetch a
// current quote per unique ticker from Yahoo (same endpoint/headers as
// scripts/fetch-backtest-prices.mjs), and write web/data/live-prices.json.
//
//   Run:  node scripts/fetch-live-prices.mjs   (or `npm run prices:fetch` from web/)
//   Safe to re-run — always refreshes every ticker (no cache skip; this is a
//   point-in-time snapshot, not an accumulating archive like backtest-cache.json).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REPORTS_DIR = path.join(ROOT, "web", "data", "reports");
const SPECULATIVE_DIR = path.join(ROOT, "web", "data", "speculative");
const DCA_DIR = path.join(ROOT, "web", "data", "dca");
const OUT_FILE = path.join(ROOT, "web", "data", "live-prices.json");
const BATCH_SIZE = 8;      // concurrent fetches per round — keeps the whole run to ~2-3 rounds
const BATCH_DELAY_MS = 300; // gentle pause between rounds

/** Scan `dir` for <TICKER>_<YYYYMMDD>.json report snapshots and collect unique tickers. */
export function collectTickers(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = new Set();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    let rep;
    try { rep = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")); } catch { continue; }
    if (rep?.ticker) out.add(rep.ticker);
  }
  return [...out];
}

// ── Yahoo Finance current quote (same host/headers as fetch-backtest-prices.mjs) ──
async function fetchQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const prevClose = meta?.previousClose ?? meta?.chartPreviousClose;
    if (price == null) return null;
    const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
    return {
      price: +price.toFixed(2),
      changePct: changePct == null ? null : +changePct.toFixed(2),
      asOf: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function main() {
  const tickers = [...new Set([
    ...collectTickers(REPORTS_DIR),
    ...collectTickers(SPECULATIVE_DIR),
    ...collectTickers(DCA_DIR),
  ])].sort();

  console.log(`📈 ${tickers.length} unique ticker(s) across reports/ + speculative/ + dca/`);

  const prices = {};
  const failed = [];

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(async (ticker) => ({ ticker, quote: await fetchQuote(ticker) })));
    for (const { ticker, quote } of results) {
      if (quote) {
        prices[ticker] = quote;
        console.log(`  ✓ ${ticker} → $${quote.price}${quote.changePct != null ? ` (${quote.changePct >= 0 ? "+" : ""}${quote.changePct}%)` : ""}`);
      } else {
        failed.push(ticker);
        console.log(`  ✗ ${ticker} → no data`);
      }
    }
    if (i + BATCH_SIZE < tickers.length) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  const out = { generatedAt: new Date().toISOString(), prices };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));

  console.log(`✅ live prices done · ${Object.keys(prices).length} fetched · ${failed.length} failed · → web/data/live-prices.json`);
  if (failed.length) console.log(`   failed: ${failed.join(", ")}`);
}

// Only run when invoked directly — importing this module (e.g. from a
// verification script) must not trigger network calls or file writes.
if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}

export { REPORTS_DIR, SPECULATIVE_DIR, DCA_DIR, OUT_FILE };
