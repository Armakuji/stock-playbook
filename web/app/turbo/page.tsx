import type { Metadata } from "next";
import { getAllSpeculativeReports, rankTurboReports } from "@/lib/speculative";
import { getTurboRankingChanges } from "@/lib/ranking-history";
import { TurboContent } from "./TurboContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Turbo — Moonshot Plays, 300%+ Bull Case",
  description:
    "Small/mid-cap moonshots with a 300%+ bull case and a binary catalyst — high-risk, ranked by most possible upside. Not for core holdings.",
  alternates: { canonical: "/turbo" },
};

export default function TurboPage() {
  const ranked = rankTurboReports(getAllSpeculativeReports());
  const rankChanges = getTurboRankingChanges();
  return <TurboContent ranked={ranked} rankChanges={rankChanges} />;
}
