import { getAllSpeculativeReports, rankTurboReports } from "@/lib/speculative";
import { getTurboRankingChanges } from "@/lib/ranking-history";
import { getAllDcaReports } from "@/lib/dca";
import { getAllReports } from "@/lib/reports";
import { formatSiteLastUpdated, getSiteLastUpdatedIso } from "@/lib/site-meta";
import { TurboContent } from "./TurboContent";

export const dynamic = "force-dynamic";

export default function TurboPage() {
  const ranked = rankTurboReports(getAllSpeculativeReports());
  const rankChanges = getTurboRankingChanges();
  const dashboardCounts = {
    dca: getAllDcaReports().length,
    catalyst: getAllReports().length,
    turbo: getAllSpeculativeReports().length,
  };
  return (
    <TurboContent
      ranked={ranked}
      rankChanges={rankChanges}
      dashboardCounts={dashboardCounts}
      lastUpdated={formatSiteLastUpdated(getSiteLastUpdatedIso())}
    />
  );
}
