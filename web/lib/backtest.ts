import fs from "fs";
import path from "path";
import { StockReport } from "./types";

const REPORTS_DIR = path.join(process.cwd(), "data", "reports");
const CACHE_FILE  = path.join(process.cwd(), "data", "backtest-cache.json");

// ── Types ─────────────────────────────────────────────────────────────────────

export type CheckpointStatus = "pending" | "hit" | "miss" | "partial";

export interface Checkpoint {
  days: 30 | 60 | 90;
  targetDate: string;   // YYYY-MM-DD
  expectedDir: "up" | "down" | "flat"; // what a BUY/SELL/HOLD implies
  actualPrice: number | null;
  actualPct: number | null;   // % change from report price
  status: CheckpointStatus;
}

export interface BacktestEntry {
  ticker: string;
  companyName: string;
  reportDate: string;  // "YYYYMMDD"
  reportPrice: number;
  verdict: StockReport["verdict"];
  score: number | null;
  checkpoints: Checkpoint[];
}

export interface BacktestStats {
  totalEntries: number;
  completedCheckpoints: number;
  pendingCheckpoints: number;
  byVerdict: Record<string, {
    count: number;
    avg30d: number | null;
    avg60d: number | null;
    avg90d: number | null;
    hitRate: number | null;  // for BUY: % that were positive at 30d
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  // dateStr: "YYYYMMDD"
  const y = parseInt(dateStr.slice(0, 4));
  const m = parseInt(dateStr.slice(4, 6)) - 1;
  const d = parseInt(dateStr.slice(6, 8));
  const dt = new Date(y, m, d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function expectedDirection(verdict: StockReport["verdict"]): "up" | "down" | "flat" {
  if (verdict === "BUY" || verdict === "SPECULATIVE") return "up";
  if (verdict === "SELL") return "down";
  return "flat";
}

// ── Cache ─────────────────────────────────────────────────────────────────────

interface PriceCache {
  [key: string]: { price: number; fetchedAt: string };
}

export function readCache(): PriceCache {
  if (!fs.existsSync(CACHE_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")); }
  catch { return {}; }
}

export function writeCache(cache: PriceCache): void {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

export function cacheKey(ticker: string, date: string): string {
  return `${ticker}_${date}`;
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildBacktestEntries(priceCache: PriceCache): BacktestEntry[] {
  if (!fs.existsSync(REPORTS_DIR)) return [];

  const today = new Date().toISOString().slice(0, 10);

  // Read ALL files (not deduplicated — we want every historical snapshot)
  const files = fs.readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const entries: BacktestEntry[] = [];

  for (const filename of files) {
    const dateMatch = filename.match(/_(\d{8})\.json$/);
    if (!dateMatch) continue;
    const reportDate = dateMatch[1];

    let report: StockReport;
    try {
      report = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, filename), "utf-8"));
    } catch { continue; }

    const checkpoints: Checkpoint[] = ([30, 60, 90] as const).map((days) => {
      const targetDate = addDays(reportDate, days);
      const isPast = targetDate <= today;
      const cachedPrice = isPast ? (priceCache[cacheKey(report.ticker, targetDate)]?.price ?? null) : null;
      const actualPct = cachedPrice !== null
        ? ((cachedPrice - report.price) / report.price) * 100
        : null;

      let status: CheckpointStatus = "pending";
      if (isPast && cachedPrice !== null) {
        const dir = expectedDirection(report.verdict);
        if (dir === "up")   status = actualPct! > 0 ? "hit" : "miss";
        else if (dir === "down") status = actualPct! < 0 ? "hit" : "miss";
        else status = Math.abs(actualPct!) < 10 ? "hit" : "miss";
      } else if (isPast && cachedPrice === null) {
        status = "pending"; // needs fetch
      }

      return {
        days,
        targetDate,
        expectedDir: expectedDirection(report.verdict),
        actualPrice: cachedPrice,
        actualPct,
        status,
      };
    });

    entries.push({
      ticker: report.ticker,
      companyName: report.companyName,
      reportDate,
      reportPrice: report.price,
      verdict: report.verdict,
      score: report.score ?? null,
      checkpoints,
    });
  }

  return entries;
}

export function computeBacktestStats(entries: BacktestEntry[]): BacktestStats {
  const verdicts = ["BUY", "HOLD", "SELL", "SPECULATIVE"] as const;
  const byVerdict: BacktestStats["byVerdict"] = {};

  for (const v of verdicts) {
    const group = entries.filter((e) => e.verdict === v);
    if (group.length === 0) continue;

    function avgAtDay(days: 30 | 60 | 90): number | null {
      const vals = group
        .map((e) => e.checkpoints.find((c) => c.days === days)?.actualPct ?? null)
        .filter((v): v is number => v !== null);
      return vals.length === 0 ? null : vals.reduce((s, x) => s + x, 0) / vals.length;
    }

    const hits = group.flatMap((e) => e.checkpoints.filter((c) => c.status === "hit")).length;
    const decided = group.flatMap((e) => e.checkpoints.filter((c) => c.status === "hit" || c.status === "miss")).length;

    byVerdict[v] = {
      count: group.length,
      avg30d: avgAtDay(30),
      avg60d: avgAtDay(60),
      avg90d: avgAtDay(90),
      hitRate: decided === 0 ? null : hits / decided,
    };
  }

  const allCps = entries.flatMap((e) => e.checkpoints);
  return {
    totalEntries: entries.length,
    completedCheckpoints: allCps.filter((c) => c.status === "hit" || c.status === "miss").length,
    pendingCheckpoints: allCps.filter((c) => c.status === "pending").length,
    byVerdict,
  };
}
