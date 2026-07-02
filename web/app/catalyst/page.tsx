import { getAllReports } from "@/lib/reports";
import { rankReports } from "@/lib/ranking";
import { getRankingChanges } from "@/lib/ranking-history";
import { getCatalystCalendar } from "@/lib/catalyst-calendar";
import { CatalystContent } from "./CatalystContent";

export const dynamic = "force-dynamic";

export default function CatalystPage() {
  const ranked = rankReports(getAllReports());
  const rankChanges = getRankingChanges();
  const calendarEvents = getCatalystCalendar();

  return (
    <CatalystContent
      ranked={ranked}
      rankChanges={rankChanges}
      calendarEvents={calendarEvents}
    />
  );
}
