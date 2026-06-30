import { notFound } from "next/navigation";
import { getReport } from "@/lib/reports";
import { getSpeculativeReport } from "@/lib/speculative";
import { getDcaReport } from "@/lib/dca";
import { getTickerTimeline } from "@/lib/timeline";
import { ReportContent } from "./ReportContent";
import { StockTimeline } from "./StockTimeline";

// Render fresh on each request so newly added/updated JSON always shows (no stale cache).
// Rendered on demand (no generateStaticParams) — unknown tickers fall through to notFound().
export const dynamic = "force-dynamic";

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
