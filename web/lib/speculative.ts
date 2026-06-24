import fs from "fs";
import path from "path";
import { StockReport } from "./types";
import { withComputedScore } from "./scoring";

const SPECULATIVE_DIR = path.join(process.cwd(), "data", "speculative");

export function getAllSpeculativeReports(): StockReport[] {
  if (!fs.existsSync(SPECULATIVE_DIR)) return [];

  const files = fs
    .readdirSync(SPECULATIVE_DIR)
    .filter((f) => f.endsWith(".json"));

  const reports = files.map((file) => {
    const content = fs.readFileSync(path.join(SPECULATIVE_DIR, file), "utf-8");
    return withComputedScore(JSON.parse(content) as StockReport);
  });

  // Sort newest first, deduplicate by ticker
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

export function getSpeculativeReport(ticker: string): StockReport | null {
  if (!fs.existsSync(SPECULATIVE_DIR)) return null;

  const files = fs
    .readdirSync(SPECULATIVE_DIR)
    .filter((f) => f.startsWith(`${ticker.toUpperCase()}_`) && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const content = fs.readFileSync(path.join(SPECULATIVE_DIR, files[0]), "utf-8");
  return withComputedScore(JSON.parse(content) as StockReport);
}

/** Rank turbo stocks by moon scenario % upside (highest first) */
export function rankTurboReports(
  reports: StockReport[]
): (StockReport & { rank: number; moonPct: number })[] {
  return reports
    .map((r) => {
      const moon = r.scenarios?.find((s) => s.label === "Moon");
      const moonPct = moon
        ? moon.pct
        : ((r.entryStrategy.tp3.price - r.price) / r.price) * 100;
      return { ...r, moonPct };
    })
    .sort((a, b) => b.moonPct - a.moonPct)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function getSpeculativeFilename(ticker: string, date?: string): string {
  const d = date ?? new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${ticker.toUpperCase()}_${d}.json`;
}
