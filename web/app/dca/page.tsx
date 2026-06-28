import { getAllDcaReports, rankDcaReports } from "@/lib/dca";
import { getDcaRankingChanges } from "@/lib/ranking-history";
import { DcaContent } from "./DcaContent";

export default function DcaPage() {
  const ranked = rankDcaReports(getAllDcaReports());
  const rankChanges = getDcaRankingChanges();
  return <DcaContent ranked={ranked} rankChanges={rankChanges} />;
}
