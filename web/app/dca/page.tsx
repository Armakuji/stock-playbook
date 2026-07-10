import type { Metadata } from "next";
import { getDcaStocks, getDcaFunds, rankDcaReports } from "@/lib/dca";
import { getDcaRankingChanges } from "@/lib/ranking-history";
import { DcaContent } from "./DcaContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DCA — Quality-Core Stocks & ETFs",
  description:
    "5 best global ETFs and 5 best quality-core stocks for long-term accumulation, ranked by quality and valuation — no catalyst needed, exit only on thesis-break.",
  alternates: { canonical: "/dca" },
};

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
