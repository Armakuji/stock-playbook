import { getAllReports } from "@/lib/reports";
import { getAllSpeculativeReports } from "@/lib/speculative";
import { getAllDcaReports } from "@/lib/dca";
import { Landing } from "./Landing";

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export default function HomePage() {
  const catalyst = getAllReports();
  const turbo = getAllSpeculativeReports();
  const dca = getAllDcaReports();

  // latest generatedAt across every bucket
  const latest = [...catalyst, ...turbo, ...dca]
    .map((r) => r.generatedAt)
    .sort()
    .reverse()[0];

  return (
    <Landing
      waterCount={dca.length}
      airCount={catalyst.length}
      fireCount={turbo.length}
      lastUpdated={formatDate(latest)}
      isLocal={!process.env.VERCEL}
    />
  );
}
