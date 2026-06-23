// ─── factors.ts — factor-correlation risk (tag-based) ───────────────────────
// The real concentration risk isn't "same theme bucket" — it's "same factor".
// NVDA + AVGO + MRVL crater together on ONE semis headline even though they sit
// in different catalyst groups. Tag each pick with the factors it rides, then
// warn when too many picks share one. CLIENT-SAFE: pure, no fs.

import { StockReport } from "./types";
import { primaryCatalystType } from "./catalyst-timing";

export const FACTOR_META: Record<string, { label: string; icon: string }> = {
  ai_semi:            { label: "AI Semiconductors",           icon: "🔩" },
  ai_software:        { label: "AI Software",                 icon: "🧠" },
  space_launch:       { label: "Space / Launch",              icon: "🛰️" },
  quantum:            { label: "Quantum",                     icon: "⚛️" },
  ev_auto:            { label: "EV / Autonomy",               icon: "🚗" },
  long_duration_rate: { label: "Long-duration (rate-sensitive)", icon: "📈" },
};

export function factorMeta(f: string): { label: string; icon: string } {
  return FACTOR_META[f] ?? { label: f.replace(/_/g, " "), icon: "🏷️" };
}

/** Factors a pick rides. Explicit report.factorTags are kept; the rest is derived
 *  from sector / business / catalyst so existing reports get useful tags for free. */
export function deriveFactorTags(report: StockReport): string[] {
  const tags = new Set<string>(report.factorTags ?? []);
  const hay = `${report.sector ?? ""} ${report.companyDescription ?? ""}`.toLowerCase();
  const ct = primaryCatalystType(report);

  if (/semiconductor|chip|foundry|silicon|xpu|gpu/.test(hay) || ct === "foundry_validation") tags.add("ai_semi");
  if (/ai software|analytics|palantir|data platform|\bsoftware\b/.test(hay)) tags.add("ai_software");
  if (/space|satellite|launch|orbit/.test(hay) || ct === "satellite_launch") tags.add("space_launch");
  if (/quantum/.test(hay)) tags.add("quantum");
  if (/\bev\b|autonom|automotive|vehicle/.test(hay)) tags.add("ev_auto");

  // Long-duration / rate-sensitive: speculative or pre-profit high-multiple growth,
  // which all sell off together on a rate / CPI surprise.
  if (report.verdict === "SPECULATIVE" || tags.has("quantum") || tags.has("space_launch") || tags.has("ai_software"))
    tags.add("long_duration_rate");

  return [...tags];
}

export interface FactorExposure {
  factor: string;
  label: string;
  icon: string;
  tickers: string[];
  ratio: number;     // share of the book carrying this factor
}

/** Factors carried by enough of the book to be a correlated-risk warning. */
export function factorConcentration(
  reports: StockReport[], opts?: { minCount?: number; minRatio?: number },
): FactorExposure[] {
  const minCount = opts?.minCount ?? 3;
  const minRatio = opts?.minRatio ?? 0.4;
  const total = reports.length || 1;

  const map: Record<string, string[]> = {};
  for (const r of reports) for (const f of deriveFactorTags(r)) (map[f] ??= []).push(r.ticker);

  return Object.entries(map)
    .map(([factor, tickers]) => ({ factor, ...factorMeta(factor), tickers, ratio: tickers.length / total }))
    .filter((e) => e.tickers.length >= minCount || e.ratio >= minRatio)
    .sort((a, b) => b.tickers.length - a.tickers.length);
}
