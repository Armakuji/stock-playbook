import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReport, getAllReports } from "@/lib/reports";
import { getSpeculativeReport, getAllSpeculativeReports } from "@/lib/speculative";
import { SimulatorContent } from "./SimulatorContent";

// Utility/calculator view of the same ticker the main report page already
// covers — noindex to avoid thin/duplicate-content competing with it.
export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const report = getReport(upper) ?? getSpeculativeReport(upper);
  return {
    title: report ? `${report.ticker} — Entry Simulator` : "Entry Simulator",
    robots: { index: false, follow: true },
  };
}

export async function generateStaticParams() {
  const core = getAllReports().map((r) => ({ ticker: r.ticker.toLowerCase() }));
  const turbo = getAllSpeculativeReports().map((r) => ({ ticker: r.ticker.toLowerCase() }));
  const seen = new Set<string>();
  return [...core, ...turbo].filter((p) => {
    if (seen.has(p.ticker)) return false;
    seen.add(p.ticker);
    return true;
  });
}

export default async function SimulatorPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const report = getReport(ticker.toUpperCase()) ?? getSpeculativeReport(ticker.toUpperCase());
  if (!report) notFound();

  return <SimulatorContent report={report} />;
}
