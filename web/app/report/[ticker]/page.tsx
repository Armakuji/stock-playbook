import { notFound } from "next/navigation";
import { getReport, getAllReports } from "@/lib/reports";
import { getTickerTimeline } from "@/lib/timeline";
import { ReportContent } from "./ReportContent";
import { StockTimeline } from "./StockTimeline";

export async function generateStaticParams() {
  const reports = getAllReports();
  return reports.map((r) => ({ ticker: r.ticker.toLowerCase() }));
}

export default async function ReportPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const report = getReport(ticker.toUpperCase());
  if (!report) notFound();

  const timelinePoints = getTickerTimeline(ticker.toUpperCase());

  return <ReportContent report={report} timelinePoints={timelinePoints} />;
}
