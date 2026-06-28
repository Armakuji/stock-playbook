import fs from "fs";
import path from "path";
import { StockReport } from "./types";
import { withDcaScore, qualityComposite } from "./dca-scoring";

const DCA_DIR = path.join(process.cwd(), "data", "dca");

export function getAllDcaReports(): StockReport[] {
  if (!fs.existsSync(DCA_DIR)) return [];

  const files = fs.readdirSync(DCA_DIR).filter((f) => f.endsWith(".json"));

  const reports = files.map((file) => {
    const content = fs.readFileSync(path.join(DCA_DIR, file), "utf-8");
    return withDcaScore(JSON.parse(content) as StockReport);
  });

  // Newest first, deduplicate by ticker
  const sorted = reports.sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  );
  const seen = new Set<string>();
  return sorted.filter((r) => {
    if (seen.has(r.ticker)) return false;
    seen.add(r.ticker);
    return true;
  });
}

export function getDcaReport(ticker: string): StockReport | null {
  if (!fs.existsSync(DCA_DIR)) return null;

  const files = fs
    .readdirSync(DCA_DIR)
    .filter((f) => f.startsWith(`${ticker.toUpperCase()}_`) && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const content = fs.readFileSync(path.join(DCA_DIR, files[0]), "utf-8");
  return withDcaScore(JSON.parse(content) as StockReport);
}

export interface RankedDca extends StockReport {
  rank: number;
  /** % below(-)/above(+) fair value — lower is a better accumulation entry */
  discountPct: number;
  /** 0–5 quality composite (or null if not provided) */
  quality: number | null;
}

/**
 * Rank quality-core picks for accumulation. Primary: DCA score (quality+valuation).
 * Tiebreakers: cheaper vs fair first, then higher quality composite.
 */
export function rankDcaReports(reports: StockReport[]): RankedDca[] {
  return reports
    .map((r) => {
      const discountPct = r.valuationBand?.currentVsFair ?? 0;
      const quality = qualityComposite(r.qualityScore);
      return { ...r, discountPct, quality };
    })
    .sort(
      (a, b) =>
        (b.dcaScore ?? 0) - (a.dcaScore ?? 0) ||
        a.discountPct - b.discountPct ||
        (b.quality ?? 0) - (a.quality ?? 0)
    )
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function getDcaFilename(ticker: string, date?: string): string {
  const d = date ?? new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${ticker.toUpperCase()}_${d}.json`;
}
