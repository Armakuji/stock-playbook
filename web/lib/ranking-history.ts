import fs from "fs";
import path from "path";
import { StockReport } from "./types";
import { rankReports } from "./ranking";

const REPORTS_DIR = path.join(process.cwd(), "data", "reports");

export interface RankChange {
  ticker: string;
  companyName: string;
  currentRank: number;
  prevRank: number | null;   // null = first appearance
  delta: number | null;       // positive = moved up, negative = moved down, null = NEW
  score: number;
  confidence: "High" | "Medium" | "Low";
  weeksInTop10: number;
  tp2Upside: number;
  verdict: StockReport["verdict"];
  price: number;
  priceChange: number;
  reason: string;
}

function scoreToConfidence(score: number): "High" | "Medium" | "Low" {
  if (score >= 75) return "High";
  if (score >= 55) return "Medium";
  return "Low";
}

function buildReason(
  curr: StockReport,
  prev: StockReport | null,
  delta: number | null
): string {
  if (!prev || delta === null) return "New addition to watchlist";

  const reasons: string[] = [];

  // Verdict upgrade / downgrade
  if (curr.verdict !== prev.verdict) {
    reasons.push(`Verdict ${prev.verdict} → ${curr.verdict}`);
  }

  // Score shift (only meaningful diffs)
  const scoreDiff = (curr.score ?? 0) - (prev.score ?? 0);
  if (Math.abs(scoreDiff) >= 5) {
    reasons.push(`Score ${scoreDiff > 0 ? "+" : ""}${scoreDiff}`);
  }

  // Fed risk change (directly affects ranking points)
  if (curr.macroRisk.fedRisk !== prev.macroRisk.fedRisk) {
    reasons.push(`Fed risk ${prev.macroRisk.fedRisk} → ${curr.macroRisk.fedRisk}`);
  }

  // TP2 upside shift (affects ranking points)
  const currUpside = ((curr.entryStrategy.tp2.price - curr.price) / curr.price) * 100;
  const prevUpside = ((prev.entryStrategy.tp2.price - prev.price) / prev.price) * 100;
  const upsideDiff = currUpside - prevUpside;
  if (Math.abs(upsideDiff) >= 8) {
    reasons.push(`TP2 upside ${upsideDiff > 0 ? "+" : ""}${Math.round(upsideDiff)}%`);
  }

  if (reasons.length === 0) {
    if (delta > 0) return "Stronger conviction vs peers";
    if (delta < 0) return "Peers rated higher this week";
    return "Unchanged";
  }
  return reasons.join(" · ");
}

export function getRankingChanges(): RankChange[] {
  if (!fs.existsSync(REPORTS_DIR)) return [];

  const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith(".json"));

  // Group by ticker: { NVDA: [{date, report}, ...] }
  const byTicker: Record<string, Array<{ date: string; report: StockReport }>> = {};

  for (const file of files) {
    const match = file.match(/^([A-Z]+)_(\d{8})\.json$/);
    if (!match) continue;
    const [, ticker, date] = match;
    const content = fs.readFileSync(path.join(REPORTS_DIR, file), "utf-8");
    const report = JSON.parse(content) as StockReport;
    if (!byTicker[ticker]) byTicker[ticker] = [];
    byTicker[ticker].push({ date, report });
  }

  // Sort each ticker's snapshots by date ascending
  for (const ticker in byTicker) {
    byTicker[ticker].sort((a, b) => a.date.localeCompare(b.date));
  }

  // Current = latest per ticker; previous = second-to-latest (if exists)
  const currentReports = Object.values(byTicker).map((arr) => arr[arr.length - 1].report);
  const prevReports = Object.values(byTicker)
    .filter((arr) => arr.length >= 2)
    .map((arr) => arr[arr.length - 2].report);

  const currentRanked = rankReports(currentReports);
  const prevRanked = rankReports(prevReports);

  // prevRankMap: ticker -> rank in previous snapshot
  const prevRankMap: Record<string, number> = {};
  for (const r of prevRanked) prevRankMap[r.ticker] = r.rank;

  // prevReportMap: ticker -> previous report (for comparison)
  const prevReportMap: Record<string, StockReport> = {};
  for (const r of prevRanked) prevReportMap[r.ticker] = r;

  // snapshot count = number of distinct date files per ticker
  const snapshotCount: Record<string, number> = {};
  for (const ticker in byTicker) snapshotCount[ticker] = byTicker[ticker].length;

  return currentRanked.map((r) => {
    const prevRank = prevRankMap[r.ticker] ?? null;
    const prev = prevReportMap[r.ticker] ?? null;
    // positive delta = moved UP in rank (e.g. was #4, now #1 → delta = +3)
    const delta = prevRank != null ? prevRank - r.rank : null;
    const tp2Upside = Math.round(
      ((r.entryStrategy.tp2.price - r.price) / r.price) * 100
    );
    const reason = buildReason(r, prev, delta);
    return {
      ticker: r.ticker,
      companyName: r.companyName,
      currentRank: r.rank,
      prevRank,
      delta,
      score: r.score ?? r.rankScore,
      confidence: scoreToConfidence(r.score ?? 0),
      weeksInTop10: snapshotCount[r.ticker] ?? 1,
      tp2Upside,
      verdict: r.verdict,
      price: r.price,
      priceChange: r.priceChange,
      reason,
    };
  });
}
