import type { Metadata } from "next";
import { getAllReports } from "@/lib/reports";
import { rankReports } from "@/lib/ranking";
import { getRankingChanges } from "@/lib/ranking-history";
import { getCatalystCalendar } from "@/lib/catalyst-calendar";
import { CatalystContent } from "./CatalystContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catalyst Dashboard — 30%+ Upside Picks",
  description:
    "5 stocks screened for 30%+ near-term upside on a dated catalyst — earnings, launches, FDA decisions. Ranked by catalyst proximity, re-screened automatically.",
  alternates: { canonical: "/catalyst" },
};

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
