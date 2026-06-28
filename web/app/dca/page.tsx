import { getAllDcaReports, rankDcaReports } from "@/lib/dca";
import { DcaContent } from "./DcaContent";

export default function DcaPage() {
  const ranked = rankDcaReports(getAllDcaReports());
  return <DcaContent ranked={ranked} />;
}
