// ─── stop-status.ts — has a pick already hit its own stop? ──────────────────
// A report's stop loss is written once and never re-checked, so a pick whose
// live price already sits below its hard stop kept ranking on the board as if
// the thesis were intact (BTBT, CRDO as of 2026-11-11). This flags those picks
// from web/data/live-prices.json (written by `npm run prices:fetch`) so pages
// can move them off the active board.
//
// SERVER-SIDE (reads fs). Rule:
//   STOPPED = live price ≤ entryStrategy.stopLoss.hard (the "thesis broken"
//             line), using a quote taken AFTER the report was written — a
//             report refreshed after the drop writes a new stop and is not
//             stopped by an older quote.
// The tight stop is deliberately not used here: it is a trading stop sized
// for an Entry-1 fill, and a dip-entry holder may legitimately sit below it.
// The backtest counterpart (stop-adjusted series) lives in
// scripts/build-skill-feedback.mjs — keep the rule (hard stop) in sync.

import fs from "fs";
import path from "path";
import { StockReport } from "./types";

export interface LiveQuote { price: number; changePct?: number; asOf: string }

export interface StopHit {
  ticker: string;
  livePrice: number;
  hardStop: number;
  /** live vs report price, % */
  movePct: number;
  asOf: string;
}

const LIVE_PRICES_FILE = path.join(process.cwd(), "data", "live-prices.json");

export function readLivePrices(): Record<string, LiveQuote> {
  try {
    const j = JSON.parse(fs.readFileSync(LIVE_PRICES_FILE, "utf-8"));
    return (j?.prices ?? {}) as Record<string, LiveQuote>;
  } catch {
    return {};
  }
}

export function stopHit(report: StockReport, live: Record<string, LiveQuote>): StopHit | null {
  const q = live[report.ticker];
  const hard = report.entryStrategy?.stopLoss?.hard;
  if (!q || typeof q.price !== "number" || q.price <= 0) return null;
  if (typeof hard !== "number" || hard <= 0) return null;
  // Only a quote taken after the report counts — otherwise a fresh report
  // (new stop) would be judged against the pre-refresh price.
  const asOfMs = Date.parse(q.asOf);
  const genMs = Date.parse(report.generatedAt);
  if (Number.isNaN(asOfMs) || (!Number.isNaN(genMs) && asOfMs < genMs)) return null;
  if (q.price > hard) return null;
  return {
    ticker: report.ticker,
    livePrice: q.price,
    hardStop: hard,
    movePct: report.price ? Math.round(((q.price - report.price) / report.price) * 1000) / 10 : 0,
    asOf: q.asOf,
  };
}

/** Split reports into active vs stopped-out (live ≤ hard stop). */
export function partitionStopped<T extends StockReport>(
  reports: T[],
  live: Record<string, LiveQuote> = readLivePrices(),
): { active: T[]; stopped: (StopHit & { report: T })[] } {
  const active: T[] = [];
  const stopped: (StopHit & { report: T })[] = [];
  for (const r of reports) {
    const hit = stopHit(r, live);
    if (hit) stopped.push({ ...hit, report: r });
    else active.push(r);
  }
  stopped.sort((a, b) => a.movePct - b.movePct);
  return { active, stopped };
}
