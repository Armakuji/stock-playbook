import { getAllReports } from "@/lib/reports";
import { getAllSpeculativeReports } from "@/lib/speculative";
import { getAllDcaReports } from "@/lib/dca";
import { formatSiteLastUpdated, getSiteLastUpdatedIso } from "@/lib/site-meta";
import { Landing } from "./Landing";

// Always read fresh JSON on each request (no stale static cache locally)
export const dynamic = "force-dynamic";

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
