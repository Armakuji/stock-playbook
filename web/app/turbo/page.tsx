import { getAllSpeculativeReports, rankTurboReports } from "@/lib/speculative";
import { TurboContent } from "./TurboContent";

export default function TurboPage() {
  const ranked = rankTurboReports(getAllSpeculativeReports());
  return <TurboContent ranked={ranked} />;
}
