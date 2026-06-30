import fs from "fs";
import path from "path";
import { getAllReports } from "@/lib/reports";
import { rankReports } from "@/lib/ranking";
import { getRankingChanges } from "@/lib/ranking-history";
import { getCatalystCalendar } from "@/lib/catalyst-calendar";
import { CatalystContent } from "./CatalystContent";

function loadMarketTiming() {
  try {
    const p = path.join(process.cwd(), "data", "market-timing.json");
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export default function CatalystPage() {
  const ranked = rankReports(getAllReports());
  const rankChanges = getRankingChanges();
  const calendarEvents = getCatalystCalendar();
  const marketTiming = loadMarketTiming();

  return (
    <CatalystContent
      ranked={ranked}
      rankChanges={rankChanges}
      calendarEvents={calendarEvents}
      marketTiming={marketTiming}
    />
  );
}
