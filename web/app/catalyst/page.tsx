import { getAllReports } from "@/lib/reports";
import { rankReports } from "@/lib/ranking";
import { getRankingChanges } from "@/lib/ranking-history";
import { getCatalystCalendar } from "@/lib/catalyst-calendar";
import { getAllDcaReports } from "@/lib/dca";
import { getAllSpeculativeReports } from "@/lib/speculative";
import { formatSiteLastUpdated, getSiteLastUpdatedIso } from "@/lib/site-meta";
import { CatalystContent } from "./CatalystContent";

export const dynamic = "force-dynamic";

export default function CatalystPage() {
  const ranked = rankReports(getAllReports());
  const rankChanges = getRankingChanges();
  const calendarEvents = getCatalystCalendar();
  const dashboardCounts = {
    dca: getAllDcaReports().length,
    catalyst: getAllReports().length,
    turbo: getAllSpeculativeReports().length,
  };

  return (
    <CatalystContent
      ranked={ranked}
      rankChanges={rankChanges}
      calendarEvents={calendarEvents}
      dashboardCounts={dashboardCounts}
      lastUpdated={formatSiteLastUpdated(getSiteLastUpdatedIso())}
    />
  );
}
