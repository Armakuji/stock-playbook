import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReport } from "@/lib/reports";
import { getSpeculativeReport } from "@/lib/speculative";
import { getDcaReport } from "@/lib/dca";
import { getTickerTimeline } from "@/lib/timeline";
import { SITE_URL, truncateDescription } from "@/lib/site-meta";
import { StockReport } from "@/lib/types";
import { ReportContent } from "./ReportContent";
import { StockTimeline } from "./StockTimeline";

// Render fresh on each request so newly added/updated JSON always shows (no stale cache).
// Rendered on demand (no generateStaticParams) — unknown tickers fall through to notFound().
export const dynamic = "force-dynamic";

/** Same cross-pool resolution as the page itself (core catalyst → turbo → DCA)
 *  — shared by generateMetadata and the page component so both agree on which
 *  report backs a given ticker. */
function resolveReport(upper: string): { report: StockReport | null; isTurbo: boolean; isDca: boolean } {
  const coreReport = getReport(upper);
  const specReport = coreReport ? null : getSpeculativeReport(upper);
  const dcaReport = coreReport || specReport ? null : getDcaReport(upper);
  return { report: coreReport ?? specReport ?? dcaReport, isTurbo: !!specReport, isDca: !!dcaReport };
}

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const { report } = resolveReport(upper);
  if (!report) return { title: "Report not found" };

  const title = `${report.ticker} — entry, targets, catalyst`;
  const description = truncateDescription(report.summary);
  const canonical = `/report/${upper.toLowerCase()}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title: `${title} · StockPlaybook`, description, url: canonical, type: "article" },
    twitter: { card: "summary", title: `${title} · StockPlaybook`, description },
    // TODO(#18 follow-up): once a per-report OG image asset exists, add
    // openGraph.images / twitter.images here instead of falling back to the
    // site-wide default (currently none — metadata-only per backlog #19).
  };
}

export default async function ReportPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const { report, isTurbo, isDca } = resolveReport(upper);
  if (!report) notFound();

  const timelinePoints = getTickerTimeline(upper);

  // AnalysisNewsArticle (not a financial-product/advice schema) — factual
  // headline + publish date only, safe-serialized, no user-controlled HTML.
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "AnalysisNewsArticle",
    headline: `${report.ticker} — ${report.companyName} stock analysis`,
    description: truncateDescription(report.summary),
    datePublished: report.generatedAt,
    dateModified: report.generatedAt,
    url: `${SITE_URL}/report/${upper.toLowerCase()}`,
    author: { "@type": "Organization", name: "Stock Playbook Research" },
    publisher: { "@type": "Organization", name: "Stock Playbook", url: SITE_URL },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- static-shaped object built from server data only, no raw user HTML
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <ReportContent report={report} timelinePoints={timelinePoints} isTurbo={isTurbo} isDca={isDca} />
    </>
  );
}
