import { getAllSpeculativeReports, rankTurboReports } from "@/lib/speculative";
import { getTurboRankingChanges } from "@/lib/ranking-history";
import { TurboContent } from "./TurboContent";

export const dynamic = "force-dynamic";

export default function TurboPage() {
  const ranked = rankTurboReports(getAllSpeculativeReports());
  const rankChanges = getTurboRankingChanges();
  return <TurboContent ranked={ranked} rankChanges={rankChanges} />;
}
