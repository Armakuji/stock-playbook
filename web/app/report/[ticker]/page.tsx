import { notFound } from "next/navigation";
import { getReport, getAllReports } from "@/lib/reports";
import { ReportContent } from "./ReportContent";

export async function generateStaticParams() {
  const reports = getAllReports();
  return reports.map((r) => ({ ticker: r.ticker.toLowerCase() }));
}

export default async function ReportPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const report = getReport(ticker.toUpperCase());
  if (!report) notFound();

  return <ReportContent report={report} />;
}
