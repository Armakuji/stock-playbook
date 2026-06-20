import fs from "fs";
import path from "path";
import { StockReport } from "./types";

const REPORTS_DIR = path.join(process.cwd(), "data", "reports");

export function getAllReports(): StockReport[] {
  if (!fs.existsSync(REPORTS_DIR)) return [];

  const files = fs
    .readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith(".json"));

  const reports = files.map((file) => {
    const content = fs.readFileSync(path.join(REPORTS_DIR, file), "utf-8");
    return JSON.parse(content) as StockReport;
  });

  // Sort by generatedAt descending (newest report first)
  return reports.sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  );
}

export function getReport(ticker: string): StockReport | null {
  if (!fs.existsSync(REPORTS_DIR)) return null;

  // Find the latest report for this ticker
  const files = fs
    .readdirSync(REPORTS_DIR)
    .filter((f) => f.startsWith(`${ticker.toUpperCase()}_`) && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const content = fs.readFileSync(path.join(REPORTS_DIR, files[0]), "utf-8");
  return JSON.parse(content) as StockReport;
}

export function getReportFilename(ticker: string, date?: string): string {
  const d = date ?? new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${ticker.toUpperCase()}_${d}.json`;
}
