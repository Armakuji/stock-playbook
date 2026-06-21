import { notFound } from "next/navigation";
import { getReport, getAllReports } from "@/lib/reports";
import { SimulatorContent } from "./SimulatorContent";

export async function generateStaticParams() {
  const reports = getAllReports();
  return reports.map((r) => ({ ticker: r.ticker.toLowerCase() }));
}

export default async function SimulatorPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const report = getReport(ticker.toUpperCase());
  if (!report) notFound();

  return <SimulatorContent report={report} />;
}
