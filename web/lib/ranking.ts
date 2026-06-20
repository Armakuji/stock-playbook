import { StockReport } from "./types";

const VERDICT_SCORE: Record<StockReport["verdict"], number> = {
  BUY: 40,
  HOLD: 20,
  SPECULATIVE: 10,
  SELL: 0,
};

const FED_RISK_SCORE: Record<string, number> = {
  LOW: 20,
  MEDIUM: 10,
  HIGH: 0,
};

/**
 * Composite ranking score (0–100):
 * - 40pts: Verdict (BUY=40, HOLD=20, SPECULATIVE=10, SELL=0)
 * - 20pts: Fed risk (LOW=20, MEDIUM=10, HIGH=0)
 * - 20pts: Internal score (if present, scaled to 20)
 * - 10pts: Price momentum (positive % change)
 * - 10pts: Upside to TP2 (vs current price)
 */
export function computeRankScore(report: StockReport): number {
  const verdictPts = VERDICT_SCORE[report.verdict] ?? 0;
  const fedPts = FED_RISK_SCORE[report.macroRisk.fedRisk] ?? 0;
  const scorePts = report.score != null ? (report.score / 100) * 20 : 10;
  const momentumPts = report.priceChange > 0 ? Math.min(report.priceChange, 10) : 0;
  const tp2Upside =
    ((report.entryStrategy.tp2.price - report.price) / report.price) * 100;
  const upsidePts = Math.min(Math.max(tp2Upside / 5, 0), 10);

  return Math.round(verdictPts + fedPts + scorePts + momentumPts + upsidePts);
}

export function rankReports(reports: StockReport[]): (StockReport & { rank: number; rankScore: number })[] {
  return reports
    .map((r) => ({ ...r, rankScore: computeRankScore(r) }))
    .sort((a, b) => b.rankScore - a.rankScore)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
