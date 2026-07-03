// ─── near-miss.ts — counterfactual log (anti-survivorship-bias) ─────────────
// SERVER-SIDE (reads web/data/near-misses.json + the backtest price cache).
// A near-miss = a candidate that passed the /dashboard screen but missed top 5.
// Tracking its real outcome tells us whether the top-5 selection adds alpha,
// instead of only ever grading the picks we kept.

import fs from "fs";
import path from "path";
import { readCache, cacheKey } from "./backtest";

const STORE = path.join(process.cwd(), "data", "near-misses.json");

export interface NearMiss {
  screenDate: string;        // "YYYYMMDD" — the dashboard run date
  ticker: string;
  companyName?: string;
  reason: string;            // why it didn't make the cut (e.g. "rank 6 · lower R/R")
  screenPrice: number;       // price at screen time
  screenUpsidePct?: number;  // implied upside cited at screen
  verdictAtScreen?: string;
  catalystType?: string;
}

export interface NearMissFile { _note?: string; nearMisses: NearMiss[] }

export interface NearMissOutcome extends NearMiss {
  pct14: number | null;      // % move 14d after screen (null = not yet / no price)
  pct30: number | null;
}

function addDays(yyyymmdd: string, days: number): string {
  const y = +yyyymmdd.slice(0, 4), m = +yyyymmdd.slice(4, 6) - 1, d = +yyyymmdd.slice(6, 8);
  const dt = new Date(y, m, d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function readNearMisses(): NearMiss[] {
  try {
    const j = JSON.parse(fs.readFileSync(STORE, "utf-8")) as NearMissFile;
    const arr = Array.isArray(j.nearMisses) ? j.nearMisses : [];
    // Normalize legacy field names: date→screenDate, priceAtScreen→screenPrice, impliedUpside→screenUpsidePct
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return arr.map((nm: any) => ({
      ...nm,
      screenDate:      nm.screenDate ?? (nm.date ? nm.date.replace(/-/g, "") : undefined),
      screenPrice:     nm.screenPrice ?? nm.priceAtScreen ?? 0,
      screenUpsidePct: nm.screenUpsidePct ?? nm.impliedUpside,
    } as NearMiss));
  } catch { return []; }
}

export function computeNearMissOutcomes(): NearMissOutcome[] {
  const cache = readCache();
  const today = new Date().toISOString().slice(0, 10);
  const pct = (nm: NearMiss, days: number): number | null => {
    if (!nm.screenDate) return null;
    const target = addDays(nm.screenDate, days);
    if (target > today) return null;
    const p = cache[cacheKey(nm.ticker, target)]?.price ?? null;
    return p != null && nm.screenPrice > 0 ? ((p - nm.screenPrice) / nm.screenPrice) * 100 : null;
  };
  return readNearMisses()
    .map((nm) => ({ ...nm, pct14: pct(nm, 14), pct30: pct(nm, 30) }))
    .sort((a, b) => (b.screenDate ?? "").localeCompare(a.screenDate ?? ""));
}
