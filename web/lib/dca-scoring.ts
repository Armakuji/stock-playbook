// ─── dca-scoring.ts — deterministic conviction score for QUALITY-CORE picks ──
// Counterpart to scoring.ts, but tuned for long-term DCA holdings, NOT
// near-term catalyst trades. Catalyst R/R and catalyst density are irrelevant
// here; durable quality and valuation are what matter.
//
// Same JSON in → same score out. Pure functions only (client-safe, no fs).
//
// Weights (max 100):
//   Quality composite (moat/margin/FCF/balance) ... 40
//   Valuation (cheaper vs fair = more) ............. 25
//   Verdict conviction ............................. 15
//   Technical entry context ........................ 10
//   Macro resilience (low Fed sensitivity best) .... 10

import { StockReport, ScoreComponent, QualityScore } from "./types";

export interface DcaScoreResult {
  score: number;
  breakdown: ScoreComponent[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const VERDICT_BASE: Record<StockReport["verdict"], number> = {
  BUY: 15, HOLD: 9, SPECULATIVE: 6, SELL: 0,
};
// For a core holding LOW Fed sensitivity is best — we want resilience, not a rate bet.
const FED_PTS: Record<string, number> = { LOW: 10, MEDIUM: 6, HIGH: 2 };

/** Composite 0–5 from the four quality sub-scores (uses explicit composite if given). */
export function qualityComposite(q?: QualityScore): number | null {
  if (!q) return null;
  if (typeof q.composite === "number") return clamp(q.composite, 0, 5);
  const parts = [q.moat, q.marginTrend, q.fcf, q.balanceSheet].filter(
    (n) => typeof n === "number"
  );
  if (!parts.length) return null;
  return clamp(parts.reduce((s, n) => s + n, 0) / parts.length, 0, 5);
}

/** Median analyst upside % vs current price — used as a quality/valuation proxy. */
function analystUpsidePct(report: StockReport): number | null {
  const tgts = (report.analystTargets ?? [])
    .map((t) => t.target)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (!tgts.length || report.price <= 0) return null;
  const median = tgts[Math.floor(tgts.length / 2)];
  return ((median - report.price) / report.price) * 100;
}

export function computeDcaScore(report: StockReport): DcaScoreResult {
  const b: ScoreComponent[] = [];

  // 1) Quality composite — max 40
  const qc = qualityComposite(report.qualityScore);
  let qPts: number, qDetail: string;
  if (qc != null) {
    qPts = clamp((qc / 5) * 40, 0, 40);
    qDetail = `${qc.toFixed(1)}/5 quality`;
  } else {
    // Proxy: a BUY-rated name with analyst upside earns partial quality credit.
    const up = analystUpsidePct(report);
    const verdictCredit = report.verdict === "BUY" ? 22 : report.verdict === "HOLD" ? 14 : 8;
    const upCredit = up != null ? clamp(up / 4, 0, 8) : 0;
    qPts = clamp(verdictCredit + upCredit, 0, 40);
    qDetail = "proxy (no qualityScore)";
  }
  b.push({ label: "Quality composite", points: +qPts.toFixed(1), max: 40, detail: qDetail });

  // 2) Valuation — max 25. Cheaper than fair earns more; expensive is penalized.
  let vPts = 0, vDetail = "no valuation";
  const vb = report.valuationBand;
  if (vb && typeof vb.currentVsFair === "number") {
    // -20% (cheap) → ~25 pts; 0% (fair) → ~12.5; +20% (expensive) → ~0
    vPts = clamp(12.5 - vb.currentVsFair * 0.625, 0, 25);
    vDetail = `${vb.currentVsFair >= 0 ? "+" : ""}${vb.currentVsFair.toFixed(0)}% vs fair · ${vb.zone}`;
  } else {
    const up = analystUpsidePct(report);
    if (up != null) {
      vPts = clamp(up / 2, 0, 25); // +50% upside ⇒ full
      vDetail = `${up >= 0 ? "+" : ""}${up.toFixed(0)}% analyst upside (proxy)`;
    }
  }
  b.push({ label: "Valuation", points: +vPts.toFixed(1), max: 25, detail: vDetail });

  // 3) Verdict conviction — max 15
  b.push({
    label: "Verdict conviction",
    points: VERDICT_BASE[report.verdict] ?? 8,
    max: 15,
    detail: report.verdict,
  });

  // 4) Technical entry context — max 10
  let tPts = 5, tDetail = "neutral (no data)";
  const tn = report.technicalNote;
  if (tn) {
    let p = 0;
    if (tn.above200dma === true) p += 6;
    else if (tn.above200dma === false) p += 2;
    else p += 4;
    if (typeof tn.rsi === "number") {
      // sweet spot 40–65; overbought (>70) or oversold (<30) less ideal for steady DCA
      p += tn.rsi >= 40 && tn.rsi <= 65 ? 4 : tn.rsi > 70 || tn.rsi < 30 ? 1 : 2.5;
    } else p += 2;
    tPts = clamp(p, 0, 10);
    tDetail = `${tn.above200dma ? ">200DMA" : tn.above200dma === false ? "<200DMA" : "DMA n/a"}${
      typeof tn.rsi === "number" ? ` · RSI ${Math.round(tn.rsi)}` : ""
    }`;
  }
  b.push({ label: "Technical entry", points: +tPts.toFixed(1), max: 10, detail: tDetail });

  // 5) Macro resilience — max 10
  b.push({
    label: "Macro resilience",
    points: FED_PTS[report.macroRisk?.fedRisk] ?? 6,
    max: 10,
    detail: report.macroRisk?.fedRisk ?? "—",
  });

  const score = clamp(Math.round(b.reduce((s, c) => s + c.points, 0)), 0, 100);
  return { score, breakdown: b };
}

/**
 * Attach the DCA score + breakdown. Also mirrors them onto the generic
 * `score` / `scoreBreakdown` fields so the shared report-detail UI
 * ("How this score is built") renders the DCA derivation for DCA picks.
 */
export function withDcaScore<T extends StockReport>(report: T): T {
  const { score, breakdown } = computeDcaScore(report);
  return {
    ...report,
    dcaScore: score,
    dcaScoreBreakdown: breakdown,
    score,
    scoreBreakdown: breakdown,
  };
}
