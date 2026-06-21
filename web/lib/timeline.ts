import fs from "fs";
import path from "path";
import { StockReport } from "./types";
import { computeRankScore } from "./ranking";

const REPORTS_DIR = path.join(process.cwd(), "data", "reports");

export interface TimelinePoint {
  date: string;          // "YYYYMMDD"
  score: number;
  targetPrice: number;   // tp2.price
  rank: number;
  rankChangeHeadline?: string;
  rankChangeUrl?: string;
}

/** Parse YYYYMMDD string from filename like "NVDA_20260621.json" */
function parseDateFromFilename(filename: string): string | null {
  const m = filename.match(/_(\d{8})\.json$/);
  return m ? m[1] : null;
}

/** Read all snapshot files for all tickers as a flat list with their file-date */
function readAllSnapshots(): { ticker: string; fileDate: string; report: StockReport }[] {
  if (!fs.existsSync(REPORTS_DIR)) return [];

  return fs
    .readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .flatMap((filename) => {
      const fileDate = parseDateFromFilename(filename);
      if (!fileDate) return [];
      try {
        const content = fs.readFileSync(path.join(REPORTS_DIR, filename), "utf-8");
        const report = JSON.parse(content) as StockReport;
        return [{ ticker: report.ticker, fileDate, report }];
      } catch {
        return [];
      }
    });
}

/**
 * For a given snapshot date (YYYYMMDD), compute the rank of `ticker` by:
 * 1. Taking the most recent snapshot for each ticker whose fileDate ≤ snapshotDate
 * 2. Running rankScore on that set
 * 3. Returning the 1-based rank of the target ticker
 */
function computeRankAt(
  ticker: string,
  snapshotDate: string,
  allSnapshots: { ticker: string; fileDate: string; report: StockReport }[]
): number {
  // For each ticker, find the latest snapshot on or before snapshotDate
  const latestPerTicker = new Map<string, { fileDate: string; report: StockReport }>();

  for (const snap of allSnapshots) {
    if (snap.fileDate > snapshotDate) continue;
    const existing = latestPerTicker.get(snap.ticker);
    if (!existing || snap.fileDate > existing.fileDate) {
      latestPerTicker.set(snap.ticker, snap);
    }
  }

  // Score and sort
  const scored = Array.from(latestPerTicker.values())
    .map(({ report }) => ({ ticker: report.ticker, rankScore: computeRankScore(report) }))
    .sort((a, b) => b.rankScore - a.rankScore);

  const idx = scored.findIndex((s) => s.ticker === ticker.toUpperCase());
  return idx === -1 ? scored.length + 1 : idx + 1;
}

/** Return all historical snapshots for a ticker, sorted by date ascending */
export function getTickerTimeline(ticker: string): TimelinePoint[] {
  if (!fs.existsSync(REPORTS_DIR)) return [];

  const upper = ticker.toUpperCase();
  const allSnapshots = readAllSnapshots();

  // All snapshots for THIS ticker, sorted ascending
  const ownSnapshots = allSnapshots
    .filter((s) => s.ticker === upper)
    .sort((a, b) => a.fileDate.localeCompare(b.fileDate));

  if (ownSnapshots.length === 0) return [];

  return ownSnapshots.map(({ fileDate, report }) => ({
    date: fileDate,
    score: report.score ?? 0,
    targetPrice: report.entryStrategy.tp2.price,
    rank: computeRankAt(upper, fileDate, allSnapshots),
    rankChangeHeadline: report.rankChangeSource?.headline,
    rankChangeUrl: report.rankChangeSource?.url,
  }));
}
