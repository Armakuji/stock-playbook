import { getAllReports } from "@/lib/reports";
import { rankReports } from "@/lib/ranking";
import { StockCard } from "./StockCard";

export default function DashboardPage() {
  const reports = getAllReports();
  const ranked = rankReports(reports);

  const buys = ranked.filter((r) => r.verdict === "BUY").length;
  const holds = ranked.filter((r) => r.verdict === "HOLD").length;
  const specs = ranked.filter((r) => r.verdict === "SPECULATIVE").length;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 900, margin: "0 0 6px",
          letterSpacing: "-0.5px", fontFamily: "var(--font-display, sans-serif)",
        }}>
          Weekly Watchlist
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 18px", fontFamily: "var(--font-mono, monospace)" }}>
          {ranked.length} stocks · ranked by conviction score
        </p>

        {/* Legend badges */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {buys > 0 && (
            <span style={{
              fontSize: 11, padding: "4px 12px", borderRadius: 8,
              background: "#10b98118", color: "#10b981",
              border: "1px solid #10b98130", fontWeight: 800,
              fontFamily: "var(--font-mono, monospace)",
            }}>
              BUY ×{buys}
            </span>
          )}
          {holds > 0 && (
            <span style={{
              fontSize: 11, padding: "4px 12px", borderRadius: 8,
              background: "#f59e0b18", color: "#f59e0b",
              border: "1px solid #f59e0b30", fontWeight: 800,
              fontFamily: "var(--font-mono, monospace)",
            }}>
              HOLD ×{holds}
            </span>
          )}
          {specs > 0 && (
            <span style={{
              fontSize: 11, padding: "4px 12px", borderRadius: 8,
              background: "#8b5cf618", color: "#8b5cf6",
              border: "1px solid #8b5cf630", fontWeight: 800,
              fontFamily: "var(--font-mono, monospace)",
            }}>
              SPEC ×{specs}
            </span>
          )}
          <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
            · verdict · Fed · score · upside
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
          {ranked.map((r, idx) => (
            <div key={`${r.ticker}-${r.generatedAt}`} style={{ animation: `cardIn 0.4s ease ${idx * 0.07}s both` }}>
              <StockCard report={r} rank={r.rank} rankScore={r.rankScore} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
