import { notFound } from "next/navigation";
import { getReport, getAllReports } from "@/lib/reports";
import { getSpeculativeReport, getAllSpeculativeReports } from "@/lib/speculative";
import { SimulatorContent } from "./SimulatorContent";

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
