// ─── north-star.ts — THE metric ────────────────────────────────────────────
// Turns the "30% Hunter" slogan into a measured number:
//   • hit  = did the stock reach +30% from report price WITHIN 14 days?
//   • MAE  = max adverse excursion = worst drawdown along the way (the pain you
//            had to endure before the target hit) — median, per catalyst type.
// SERVER-SIDE: reads web/data/reports + web/data/path-cache.json.

import fs from "fs";
import path from "path";
import { StockReport } from "./types";
import { primaryCatalystType, catalystTypeMeta } from "./catalyst-timing";

const REPORTS_DIR = path.join(process.cwd(), "data", "reports");
const PATH_CACHE  = path.join(process.cwd(), "data", "path-cache.json");

export const NS_WINDOW_DAYS = 14;
export const NS_TARGET_PCT  = 30;

export interface PricePoint { d: string; c: number }
export type PathCache = Record<string, PricePoint[]>;   // key: TICKER_YYYYMMDD

export interface NSEntry {
  ticker: string;
  reportDate: string;          // YYYYMMDD
  catalystType: string;
  label: string;               // human catalyst label
  reportPrice: number;
  maxGainPct: number | null;
  maePct: number | null;       // ≤ 0
  hit: boolean | null;
  status: "complete" | "accumulating" | "no-data";
}

export interface NSByType {
  type: string;
  label: string;
  icon: string;
  n: number;
  hitRate: number | null;
  medianMAE: number | null;
  avgMaxGain: number | null;
}

export interface NorthStar {
  windowDays: number;
  targetPct: number;
  totalComplete: number;
  totalAccumulating: number;
  hitRate: number | null;
  medianMAE: number | null;
  byType: NSByType[];
  entries: NSEntry[];
}

const pathKey = (ticker: string, reportDate: string) => `${ticker}_${reportDate}`;
const ymdToISO = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

// UTC: local-midnight Date + toISOString ends windows a day early east of UTC.
function addDaysISO(yyyymmdd: string, days: number): string {
  const y = +yyyymmdd.slice(0, 4), m = +yyyymmdd.slice(4, 6) - 1, d = +yyyymmdd.slice(6, 8);
  const dt = new Date(Date.UTC(y, m, d)); dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
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

export function computeNorthStar(): NorthStar {
  const cache = readPathCache();
  const today = new Date().toISOString().slice(0, 10);
  const entries: NSEntry[] = [];

  if (fs.existsSync(REPORTS_DIR)) {
    for (const f of fs.readdirSync(REPORTS_DIR).filter((x) => x.endsWith(".json"))) {
      const m = f.match(/_(\d{8})\.json$/);
      if (!m) continue;
      const reportDate = m[1];
      let r: StockReport;
      try { r = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), "utf-8")); } catch { continue; }
      const p0 = r.price;
      if (!p0) continue;

      const startISO = ymdToISO(reportDate);
      const endISO   = addDaysISO(reportDate, NS_WINDOW_DAYS);
      const elapsed  = endISO <= today;
      const series = (cache[pathKey(r.ticker, reportDate)] ?? [])
        .filter((pt) => pt.d >= startISO && pt.d <= endISO && typeof pt.c === "number");

      let maxGainPct: number | null = null, maePct: number | null = null, hit: boolean | null = null;
      let status: NSEntry["status"];

      if (series.length === 0) {
        status = elapsed ? "no-data" : "accumulating";
      } else {
        const gains = series.map((pt) => ((pt.c - p0) / p0) * 100);
        maxGainPct = Math.max(...gains);
        maePct = Math.min(...gains, 0);
        hit = maxGainPct >= NS_TARGET_PCT;
        status = elapsed ? "complete" : "accumulating";
      }

      entries.push({
        ticker: r.ticker, reportDate, catalystType: primaryCatalystType(r),
        label: catalystTypeMeta(primaryCatalystType(r)).label,
        reportPrice: p0, maxGainPct, maePct, hit, status,
      });
    }
  }

  const complete = entries.filter((e) => e.status === "complete");
  const byTypeMap: Record<string, NSEntry[]> = {};
  for (const e of complete) (byTypeMap[e.catalystType] ??= []).push(e);

  const byType: NSByType[] = Object.entries(byTypeMap).map(([type, es]) => {
    const meta = catalystTypeMeta(type);
    const hits = es.filter((e) => e.hit).length;
    return {
      type, label: meta.label, icon: meta.icon, n: es.length,
      hitRate: es.length ? hits / es.length : null,
      medianMAE: median(es.map((e) => e.maePct).filter((v): v is number => v !== null)),
      avgMaxGain: es.length ? es.reduce((s, e) => s + (e.maxGainPct ?? 0), 0) / es.length : null,
    };
  }).sort((a, b) => (b.hitRate ?? -1) - (a.hitRate ?? -1));

  return {
    windowDays: NS_WINDOW_DAYS,
    targetPct: NS_TARGET_PCT,
    totalComplete: complete.length,
    totalAccumulating: entries.filter((e) => e.status === "accumulating").length,
    hitRate: complete.length ? complete.filter((e) => e.hit).length / complete.length : null,
    medianMAE: median(complete.map((e) => e.maePct).filter((v): v is number => v !== null)),
    byType,
    entries,
  };
}
