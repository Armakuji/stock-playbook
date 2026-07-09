import { getDcaStocks, getDcaFunds, rankDcaReports, getAllDcaReports } from "@/lib/dca";
import { getDcaRankingChanges } from "@/lib/ranking-history";
import { getAllReports } from "@/lib/reports";
import { getAllSpeculativeReports } from "@/lib/speculative";
import { formatSiteLastUpdated, getSiteLastUpdatedIso } from "@/lib/site-meta";
import { DcaContent } from "./DcaContent";

export const dynamic = "force-dynamic";

export default function DcaPage() {
  const funds = rankDcaReports(getDcaFunds());
  const stocks = rankDcaReports(getDcaStocks());
  const fundChanges = getDcaRankingChanges("fund");
  const stockChanges = getDcaRankingChanges("stock");
  const dashboardCounts = {
    dca: getAllDcaReports().length,
    catalyst: getAllReports().length,
    turbo: getAllSpeculativeReports().length,
  };
  return (
    <DcaContent
      funds={funds}
      stocks={stocks}
      fundChanges={fundChanges}
      stockChanges={stockChanges}
      dashboardCounts={dashboardCounts}
      lastUpdated={formatSiteLastUpdated(getSiteLastUpdatedIso())}
    />
  );
}
