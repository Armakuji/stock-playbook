// ─── turbo-north-star.ts — THE moonshot metric ─────────────────────────────
// Turbo picks (web/data/speculative/) are lottery tickets, not 2-week catalyst
// events — "+30% in 14 days" (web/lib/north-star.ts) is the wrong yardstick
// for them. This measures the thesis turbo actually sells:
//   • hit  = did the stock reach +50% from report price WITHIN 30 days?
//   • timeToHitDays = calendar days from report date to the first day the
//     target was touched (null if never hit).
//   • MAE  = max adverse excursion = worst drawdown along the way (median).
// SERVER-SIDE: reads web/data/speculative + web/data/path-cache.json (turbo
// entries are namespaced "turbo:TICKER_YYYYMMDD" by
// scripts/fetch-backtest-prices.mjs so they can't collide with core keys).

import fs from "fs";
import path from "path";
import { StockReport } from "./types";
import { PathCache } from "./north-star";

const SPECULATIVE_DIR = path.join(process.cwd(), "data", "speculative");
const PATH_CACHE = path.join(process.cwd(), "data", "path-cache.json");
const TURBO_KEY_PREFIX = "turbo:";

export const TURBO_WINDOW_DAYS = 30;
export const TURBO_TARGET_PCT = 50;

export interface TurboNSEntry {
  ticker: string;
  reportDate: string;          // YYYYMMDD
  reportPrice: number;
  maxGainPct: number | null;
  maePct: number | null;       // ≤ 0
  hit: boolean | null;
  timeToHitDays: number | null; // null if never hit (or no data yet)
  status: "complete" | "accumulating" | "no-data";
}

export interface TurboNorthStar {
  windowDays: number;
  targetPct: number;
  n: number;                   // total turbo report snapshots, any status
  totalComplete: number;
  totalAccumulating: number;
  totalNoData: number;
  hitRate: number | null;      // over complete entries only
  medianMAE: number | null;    // over complete entries only
  medianTimeToHit: number | null;
  timeToHitDistribution: number[]; // sorted day-index values, hits among complete entries
  entries: TurboNSEntry[];
}

const pathKey = (ticker: string, reportDate: string) => `${TURBO_KEY_PREFIX}${ticker}_${reportDate}`;
const ymdToISO = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

// UTC: local-midnight Date + toISOString ends windows a day early east of UTC.
function addDaysISO(yyyymmdd: string, days: number): string {
  const y = +yyyymmdd.slice(0, 4), m = +yyyymmdd.slice(4, 6) - 1, d = +yyyymmdd.slice(6, 8);
  const dt = new Date(Date.UTC(y, m, d)); dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function daysBetweenISO(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00Z").getTime();
  const to = new Date(toISO + "T00:00:00Z").getTime();
  return Math.round((to - from) / 86400000);
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function readPathCache(): PathCache {
  try {
    const j = JSON.parse(fs.readFileSync(PATH_CACHE, "utf-8"));
    delete j._note;
    return j as PathCache;
  } catch { return {}; }
}

export function computeTurboNorthStar(): TurboNorthStar {
  const cache = readPathCache();
  const today = new Date().toISOString().slice(0, 10);
  const entries: TurboNSEntry[] = [];

  if (fs.existsSync(SPECULATIVE_DIR)) {
    for (const f of fs.readdirSync(SPECULATIVE_DIR).filter((x) => x.endsWith(".json"))) {
      const m = f.match(/_(\d{8})\.json$/);
      if (!m) continue;
      const reportDate = m[1];
      let r: StockReport;
      try { r = JSON.parse(fs.readFileSync(path.join(SPECULATIVE_DIR, f), "utf-8")); } catch { continue; }
      const p0 = r.price;
      if (!p0) continue;

      const startISO = ymdToISO(reportDate);
      const endISO   = addDaysISO(reportDate, TURBO_WINDOW_DAYS);
      const elapsed  = endISO <= today;
      const series = (cache[pathKey(r.ticker, reportDate)] ?? [])
        .filter((pt) => pt.d >= startISO && pt.d <= endISO && typeof pt.c === "number")
        .sort((a, b) => a.d.localeCompare(b.d));

      let maxGainPct: number | null = null, maePct: number | null = null, hit: boolean | null = null;
      let timeToHitDays: number | null = null;
      let status: TurboNSEntry["status"];

      if (series.length === 0) {
        status = elapsed ? "no-data" : "accumulating";
      } else {
        const gains = series.map((pt) => ((pt.c - p0) / p0) * 100);
        maxGainPct = Math.max(...gains);
        maePct = Math.min(...gains, 0);
        hit = maxGainPct >= TURBO_TARGET_PCT;
        status = elapsed ? "complete" : "accumulating";
        if (hit) {
          const firstHit = series.find((pt) => ((pt.c - p0) / p0) * 100 >= TURBO_TARGET_PCT);
          if (firstHit) timeToHitDays = daysBetweenISO(startISO, firstHit.d);
        }
      }

      entries.push({
        ticker: r.ticker, reportDate, reportPrice: p0,
        maxGainPct, maePct, hit, timeToHitDays, status,
      });
    }
  }

  const complete = entries.filter((e) => e.status === "complete");
  const hits = complete.filter((e) => e.hit);
  const timeToHitDistribution = hits
    .map((e) => e.timeToHitDays)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  return {
    windowDays: TURBO_WINDOW_DAYS,
    targetPct: TURBO_TARGET_PCT,
    n: entries.length,
    totalComplete: complete.length,
    totalAccumulating: entries.filter((e) => e.status === "accumulating").length,
    totalNoData: entries.filter((e) => e.status === "no-data").length,
    hitRate: complete.length ? hits.length / complete.length : null,
    medianMAE: median(complete.map((e) => e.maePct).filter((v): v is number => v !== null)),
    medianTimeToHit: median(timeToHitDistribution),
    timeToHitDistribution,
    entries,
  };
}
