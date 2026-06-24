import { notFound } from "next/navigation";
import { getReport, getAllReports } from "@/lib/reports";
import { getSpeculativeReport, getAllSpeculativeReports } from "@/lib/speculative";
import { getTickerTimeline } from "@/lib/timeline";
import { ReportContent } from "./ReportContent";
import { StockTimeline } from "./StockTimeline";

export async function generateStaticParams() {
  const core = getAllReports().map((r) => ({ ticker: r.ticker.toLowerCase() }));
  const turbo = getAllSpeculativeReports().map((r) => ({ ticker: r.ticker.toLowerCase() }));
  // deduplicate in case a ticker exists in both pools
  const seen = new Set<string>();
  return [...core, ...turbo].filter((p) => {
    if (seen.has(p.ticker)) return false;
    seen.add(p.ticker);
    return true;
  });
}

export default async function ReportPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  // Check core reports first, fall back to speculative pool
  const coreReport = getReport(upper);
  const report = coreReport ?? getSpeculativeReport(upper);
  if (!report) notFound();

  const isTurbo = !coreReport; // came from speculative pool
  const timelinePoints = getTickerTimeline(upper);

  return <ReportContent report={report} timelinePoints={timelinePoints} isTurbo={isTurbo} />;
}
