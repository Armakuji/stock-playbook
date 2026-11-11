import type { Metadata } from "next";
import { getAllSpeculativeReports, rankTurboReports } from "@/lib/speculative";
import { getTurboRankingChanges } from "@/lib/ranking-history";
import { partitionStopped } from "@/lib/stop-status";
import { TurboContent } from "./TurboContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Turbo — Moonshot Plays, 300%+ Bull Case",
  description:
    "Small/mid-cap moonshots with a 300%+ bull case and a binary catalyst — high-risk, ranked by most possible upside. Not for core holdings.",
  alternates: { canonical: "/turbo" },
};

export default function TurboPage() {
  // Picks already below their hard stop come off the board before ranking
  // (backlog #6 of the 2026-11-11 review) — see web/lib/stop-status.ts.
  const { active, stopped } = partitionStopped(getAllSpeculativeReports());
  const ranked = rankTurboReports(active);
  const rankChanges = getTurboRankingChanges();
  const stoppedRows = stopped.map((s) => ({ ticker: s.ticker, livePrice: s.livePrice, hardStop: s.hardStop, movePct: s.movePct, asOf: s.asOf }));
  return <TurboContent ranked={ranked} rankChanges={rankChanges} stopped={stoppedRows} />;
}
