// ─── scoring.ts — deterministic, reproducible conviction score ──────────────
// Same JSON in → same score out. No hand-tuning, no LLM judgement.
// The score is derived ONLY from grounded fields already in the report
// (verdict, analyst targets, scenarios, entry R/R, catalysts, Fed risk).
// CLIENT-SAFE: pure functions only, no fs / no Node APIs.
// Spec mirrored in references/scoring.md.

import { StockReport, ScoreComponent } from "./types";

export interface ScoreResult {
  score: number;               // 0–100
  breakdown: ScoreComponent[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const VERDICT_BASE: Record<StockReport["verdict"], number> = {
  BUY: 30, SPECULATIVE: 18, HOLD: 15, SELL: 4,
};
const FED_PTS: Record<string, number> = { LOW: 15, MEDIUM: 8, HIGH: 0 };

export function computeScore(report: StockReport): ScoreResult {
  const b: ScoreComponent[] = [];

  // 1) Verdict conviction — max 30
  b.push({
    label: "Verdict conviction",
    points: VERDICT_BASE[report.verdict] ?? 10,
    max: 30,
    detail: report.verdict,
  });

  // 2) Analyst upside to median target vs current price — max 20 (+40% ⇒ full)
  const tgts = (report.analystTargets ?? []).map((t) => t.target).filter((n) => n > 0).sort((a, c) => a - c);
  let upPts = 0, upDetail = "no targets";
  if (tgts.length && report.price > 0) {
    const median = tgts[Math.floor(tgts.length / 2)];
    const upPct = ((median - report.price) / report.price) * 100;
    upPts = clamp(upPct / 2, 0, 20);
    upDetail = `${upPct >= 0 ? "+" : ""}${upPct.toFixed(0)}% to median $${median}`;
  }
  b.push({ label: "Analyst upside", points: +upPts.toFixed(1), max: 20, detail: upDetail });

  // 3) Scenario asymmetry (bull/moon vs bear) — max 15 (3:1 ⇒ full)
  const sc = report.scenarios ?? [];
  let asymPts = 0, asymDetail = "no scenarios";
  if (sc.length) {
    const up = Math.max(...sc.map((s) => s.pct), 0);
    const down = Math.abs(Math.min(...sc.map((s) => s.pct), 0));
    const ratio = down > 0 ? up / down : up > 0 ? 3 : 0;
    asymPts = clamp(ratio * 5, 0, 15);
    asymDetail = `${ratio.toFixed(1)}:1 up/down`;
  }
  b.push({ label: "Scenario asymmetry", points: +asymPts.toFixed(1), max: 15, detail: asymDetail });

  // 4) Entry risk/reward (TP2 vs tight stop from entry) — max 10 (3:1 ⇒ full)
  const es = report.entryStrategy;
  const entry = es?.entryLevels?.[0]?.level ?? report.price;
  const stop = es?.stopLoss?.tight ?? es?.stopLoss?.hard ?? es?.stopLoss?.value;
  const tp2 = es?.tp2?.price;
  let rrPts = 0, rrDetail = "n/a";
  if (entry > 0 && stop && tp2 && entry > stop) {
    const rr = (tp2 - entry) / (entry - stop);
    rrPts = clamp(rr * 3.3, 0, 10);
    rrDetail = `${rr.toFixed(1)}:1`;
  }
  b.push({ label: "Entry R/R", points: +rrPts.toFixed(1), max: 10, detail: rrDetail });

  // 5) Catalyst density — max 10
  const nCat = (report.catalysts ?? []).length;
  b.push({
    label: "Catalyst density",
    points: +clamp(nCat * 3.5, 0, 10).toFixed(1),
    max: 10,
    detail: `${nCat} catalyst${nCat === 1 ? "" : "s"}`,
  });

  // 6) Macro / Fed risk — max 15
  b.push({
    label: "Macro (Fed) risk",
    points: FED_PTS[report.macroRisk?.fedRisk] ?? 8,
    max: 15,
    detail: report.macroRisk?.fedRisk ?? "—",
  });

  const score = clamp(Math.round(b.reduce((s, c) => s + c.points, 0)), 0, 100);
  return { score, breakdown: b };
}

/** Attach the computed score + breakdown to a report (overrides any hand-set value). */
export function withComputedScore<T extends StockReport>(report: T): T {
  const { score, breakdown } = computeScore(report);
  return { ...report, score, scoreBreakdown: breakdown };
}
