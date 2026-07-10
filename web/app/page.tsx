import type { Metadata } from "next";
import { getAllReports } from "@/lib/reports";
import { getAllSpeculativeReports } from "@/lib/speculative";
import { getAllDcaReports } from "@/lib/dca";
import { formatSiteLastUpdated, getSiteLastUpdatedIso } from "@/lib/site-meta";
import { Landing } from "./Landing";

// Always read fresh JSON on each request (no stale static cache locally)
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Institutional-grade Stock Analysis, Automated",
  description:
    "Three ways to play the market — Catalyst (30%+ near-term upside), DCA (quality-core long-term), Turbo (300%+ moonshots). Entry strategy, price targets, and Fed/macro risk on every pick.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const catalyst = getAllReports();
  const turbo = getAllSpeculativeReports();
  const dca = getAllDcaReports();

  return (
    <Landing
      waterCount={dca.length}
      airCount={catalyst.length}
      fireCount={turbo.length}
      lastUpdated={formatSiteLastUpdated(getSiteLastUpdatedIso())}
    />
  );
}
