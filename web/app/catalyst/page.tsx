import type { Metadata } from "next";
import { getAllReports } from "@/lib/reports";
import { rankReports } from "@/lib/ranking";
import { getRankingChanges } from "@/lib/ranking-history";
import { getCatalystCalendar } from "@/lib/catalyst-calendar";
import { partitionStopped } from "@/lib/stop-status";
import { CatalystContent } from "./CatalystContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catalyst Dashboard — 20%+ Upside, Dated Catalysts",
  description:
    "Stocks screened for 20%+ upside with a catalyst dated within about six weeks — earnings, launches, FDA decisions. Ranked by how close the catalyst is.",
  alternates: { canonical: "/catalyst" },
};

export default function CatalystPage() {
  // Picks already below their hard stop come off the board before ranking —
  // see web/lib/stop-status.ts.
  const { active, stopped } = partitionStopped(getAllReports());
  const ranked = rankReports(active);
  const stoppedRows = stopped.map((s) => ({ ticker: s.ticker, livePrice: s.livePrice, hardStop: s.hardStop, movePct: s.movePct, asOf: s.asOf }));
  const rankChanges = getRankingChanges();
  const calendarEvents = getCatalystCalendar();

  return (
    <CatalystContent
      ranked={ranked}
      rankChanges={rankChanges}
      calendarEvents={calendarEvents}
      stopped={stoppedRows}
    />
  );
}
