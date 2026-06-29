import fs from "fs";
import path from "path";
import { StockReport } from "./types";
import { rankReports } from "./ranking";
import { rankDcaReports } from "./dca";
import { rankTurboReports } from "./speculative";
import { computeScore } from "./scoring";
import { computeDcaScore } from "./dca-scoring";

const DATA_ROOT = path.join(process.cwd(), "data");
const REPORTS_DIR = path.join(DATA_ROOT, "reports");
const DCA_DIR = path.join(DATA_ROOT, "dca");
const SPECULATIVE_DIR = path.join(DATA_ROOT, "speculative");

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
  prevScore: number | null;   // null = no previous snapshot
  scoreDrift: number | null;  // current - prev, null = NEW
  source?: { headline: string; url: string; date: string };
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

/**
 * Generic ranking-change builder — shared by catalyst / DCA / turbo dashboards.
 * `rankFn` ranks a snapshot the same way its page does; `scoreOf` extracts the
 * score that drives the confidence badge + drift for that dataset.
 */
function computeRankingChanges(
  dir: string,
  rankFn: (reports: StockReport[]) => (StockReport & { rank: number })[],
  scoreOf: (r: StockReport & { rankScore?: number }) => number,
  filter?: (r: StockReport) => boolean,
): RankChange[] {
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  // Group by ticker: { NVDA: [{date, report}, ...] }
  const byTicker: Record<string, Array<{ date: string; report: StockReport }>> = {};

  for (const file of files) {
    const match = file.match(/^([A-Z]+)_(\d{8})\.json$/);
    if (!match) continue;
    const [, ticker, date] = match;
    const content = fs.readFileSync(path.join(dir, file), "utf-8");
    const report = JSON.parse(content) as StockReport;
    if (filter && !filter(report)) continue;
    if (!byTicker[ticker]) byTicker[ticker] = [];
    byTicker[ticker].push({ date, report });
  }

  for (const ticker in byTicker) {
    byTicker[ticker].sort((a, b) => a.date.localeCompare(b.date));
  }

  const currentReports = Object.values(byTicker).map((arr) => arr[arr.length - 1].report);

  const maxDate = Object.values(byTicker)
    .flatMap((arr) => arr.map((e) => e.date))
    .reduce((a, b) => (a > b ? a : b), "");

  // Previous = each ticker's latest report STRICTLY BEFORE maxDate, so tickers not
  // refreshed in the latest run still rank correctly instead of showing as NEW.
  const prevReports = Object.values(byTicker)
    .map((arr) => {
      const older = arr.filter((e) => e.date < maxDate);
      return older.length > 0 ? older[older.length - 1].report : null;
    })
    .filter((r): r is StockReport => r !== null);

  const currentRanked = rankFn(currentReports);
  const prevRanked = rankFn(prevReports);

  const prevRankMap: Record<string, number> = {};
  const prevReportMap: Record<string, StockReport> = {};
  for (const r of prevRanked) { prevRankMap[r.ticker] = r.rank; prevReportMap[r.ticker] = r; }

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
    const currScore = scoreOf(r);
    const prevScore = prev != null ? scoreOf(prev) : null;
    const scoreDrift = prevScore != null ? currScore - prevScore : null;
    return {
      ticker: r.ticker,
      companyName: r.companyName,
      currentRank: r.rank,
      prevRank,
      delta,
      score: currScore,
      confidence: scoreToConfidence(currScore),
      weeksInTop10: snapshotCount[r.ticker] ?? 1,
      tp2Upside,
      verdict: r.verdict,
      price: r.price,
      priceChange: r.priceChange,
      reason,
      prevScore,
      scoreDrift,
      source: r.rankChangeSource,
    };
  });
}

/** Catalyst dashboard ranking changes (web/data/reports). */
export function getRankingChanges(): RankChange[] {
  return computeRankingChanges(
    REPORTS_DIR,
    rankReports,
    (r) => r.score ?? r.rankScore ?? 0,
  );
}

/** DCA dashboard ranking changes (web/data/dca) — scored by the DCA model.
 *  Pass an assetType to scope to the "หุ้น" (stock) or "กองทุน" (fund) tab. */
export function getDcaRankingChanges(assetType?: "stock" | "fund"): RankChange[] {
  const filter = assetType
    ? (r: StockReport) =>
        assetType === "fund" ? r.assetType === "fund" : r.assetType !== "fund"
    : undefined;
  return computeRankingChanges(
    DCA_DIR,
    rankDcaReports,
    (r) => computeDcaScore(r).score,
    filter,
  );
}

/** Turbo dashboard ranking changes (web/data/speculative). */
export function getTurboRankingChanges(): RankChange[] {
  return computeRankingChanges(
    SPECULATIVE_DIR,
    rankTurboReports,
    (r) => computeScore(r).score,
  );
}
