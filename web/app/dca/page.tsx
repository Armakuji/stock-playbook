import { getDcaStocks, getDcaFunds, rankDcaReports } from "@/lib/dca";
import { getDcaRankingChanges } from "@/lib/ranking-history";
import { DcaContent } from "./DcaContent";

export default function DcaPage() {
  const funds = rankDcaReports(getDcaFunds());
  const stocks = rankDcaReports(getDcaStocks());
  const fundChanges = getDcaRankingChanges("fund");
  const stockChanges = getDcaRankingChanges("stock");
  return (
    <DcaContent
      funds={funds}
      stocks={stocks}
      fundChanges={fundChanges}
      stockChanges={stockChanges}
    />
  );
}
