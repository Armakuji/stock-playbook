import { notFound } from "next/navigation";
import { getReport, getAllReports } from "@/lib/reports";
import { getSpeculativeReport, getAllSpeculativeReports } from "@/lib/speculative";
import { getDcaReport, getAllDcaReports } from "@/lib/dca";
import { getTickerTimeline } from "@/lib/timeline";
import { ReportContent } from "./ReportContent";
import { StockTimeline } from "./StockTimeline";

export async function generateStaticParams() {
  const core = getAllReports().map((r) => ({ ticker: r.ticker.toLowerCase() }));
  const turbo = getAllSpeculativeReports().map((r) => ({ ticker: r.ticker.toLowerCase() }));
  const dca = getAllDcaReports().map((r) => ({ ticker: r.ticker.toLowerCase() }));
  // deduplicate in case a ticker exists in multiple pools
  const seen = new Set<string>();
  return [...core, ...turbo, ...dca].filter((p) => {
    if (seen.has(p.ticker)) return false;
    seen.add(p.ticker);
    return true;
  });
}

export default async function ReportPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  // Resolve across pools: core catalyst → speculative (turbo) → dca
  const coreReport = getReport(upper);
  const specReport = coreReport ? null : getSpeculativeReport(upper);
  const dcaReport = coreReport || specReport ? null : getDcaReport(upper);
  const report = coreReport ?? specReport ?? dcaReport;
  if (!report) notFound();

  const isTurbo = !!specReport; // fire theme only for the speculative pool
  const isDca = !!dcaReport;    // ice-blue theme for the DCA pool
  const timelinePoints = getTickerTimeline(upper);

  return <ReportContent report={report} timelinePoints={timelinePoints} isTurbo={isTurbo} isDca={isDca} />;
}
