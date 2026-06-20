import { getAllReports } from "@/lib/reports";
import { rankReports } from "@/lib/ranking";
import { StockCard } from "./StockCard";

export default function DashboardPage() {
  const reports = getAllReports();
  const ranked = rankReports(reports);

  // Summary counts
  const buys = ranked.filter((r) => r.verdict === "BUY").length;
  const holds = ranked.filter((r) => r.verdict === "HOLD").length;
  const specs = ranked.filter((r) => r.verdict === "SPECULATIVE").length;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.5px" }}>
          Weekly Watchlist
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
          {ranked.length} stocks · ranked by conviction score
        </p>

        {/* Legend */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {buys > 0 && (
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "#10b98120", color: "#10b981", border: "1px solid #10b98130" }}>
              BUY ×{buys}
            </span>
          )}
          {holds > 0 && (
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b30" }}>
              HOLD ×{holds}
            </span>
          )}
          {specs > 0 && (
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "#8b5cf620", color: "#8b5cf6", border: "1px solid #8b5cf630" }}>
              SPECULATIVE ×{specs}
            </span>
          )}
          <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>
            · Ranked by: verdict · Fed risk · score · upside
          </span>
        </div>
      </div>

      {/* Grid */}
      {ranked.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <p style={{ fontSize: 15, margin: 0 }}>
            No reports yet. Run <code>/analyze TICKER</code> to generate one.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {ranked.map((r) => (
            <StockCard key={`${r.ticker}-${r.generatedAt}`} report={r} rank={r.rank} rankScore={r.rankScore} />
          ))}
        </div>
      )}
    </div>
  );
}
