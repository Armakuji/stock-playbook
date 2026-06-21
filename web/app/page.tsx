import { getAllReports } from "@/lib/reports";
import { rankReports } from "@/lib/ranking";
import { getRankingChanges } from "@/lib/ranking-history";
import { getCatalystCalendar } from "@/lib/catalyst-calendar";
import { StockCard } from "./StockCard";
import { RankingChangeTable } from "./RankingChangeTable";
import { CatalystCalendar } from "./CatalystCalendar";
import { ThemeGroups } from "./ThemeGroups";

export default function DashboardPage() {
  const reports = getAllReports();
  const ranked = rankReports(reports);
  const rankChanges = getRankingChanges();
  const calendarEvents = getCatalystCalendar();

  // drift map: ticker → scoreDrift (used by StockCard)
  const driftMap: Record<string, number | null> = {};
  for (const rc of rankChanges) driftMap[rc.ticker] = rc.scoreDrift;

  const buys  = ranked.filter((r) => r.verdict === "BUY").length;
  const holds = ranked.filter((r) => r.verdict === "HOLD").length;
  const specs = ranked.filter((r) => r.verdict === "SPECULATIVE").length;

  const avgUpside = ranked.length > 0
    ? Math.round(ranked.reduce((s, r) => s + ((r.entryStrategy.tp2.price - r.price) / r.price) * 100, 0) / ranked.length)
    : 0;
  const avgScore = ranked.length > 0
    ? Math.round(ranked.reduce((s, r) => s + (r.score ?? 0), 0) / ranked.length)
    : 0;
  const lowFedRisk = ranked.filter((r) => r.macroRisk.fedRisk === "LOW").length;
  const topPick = ranked[0];

  const statsItems = [
    { label: "Top Pick",       value: topPick?.ticker ?? "—",            color: "#10b981"     },
    { label: "Avg TP2 Upside", value: `+${avgUpside}%`,                  color: "#10b981"     },
    { label: "Avg Score",      value: `${avgScore}`,                      color: "var(--text)" },
    { label: "Low Fed Risk",   value: `${lowFedRisk} / ${ranked.length}`, color: "#10b981"     },
    { label: "BUY Signals",    value: `${buys}`,                          color: "#10b981"     },
  ];

  return (
    <div>
      {/* ── Hero header ───────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ position: "relative", width: 18, height: 18, flexShrink: 0 }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "2px solid #10b981",
              animation: "livePulse 2s ease-in-out infinite",
            }} />
            <div style={{ position: "absolute", inset: 4, borderRadius: "50%", background: "#10b981" }} />
          </div>
          <h1 style={{
            fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 900, margin: 0,
            letterSpacing: "-0.5px", fontFamily: "var(--font-display, sans-serif)",
          }}>
            Weekly Watchlist
          </h1>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 20px", fontFamily: "var(--font-mono, monospace)" }}>
          {ranked.length} stocks · ranked by conviction · {new Date().toLocaleDateString("en-GB")}
        </p>

        {/* ── Radar Stats strip ─────────────────────────────── */}
        {ranked.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: 8, marginBottom: 20,
          }}>
            {statsItems.map(({ label, value, color }) => (
              <div key={label} style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "10px 12px",
              }}>
                <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4, fontFamily: "var(--font-mono, monospace)" }}>
                  {label}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color, fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.5px" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Verdict badges ────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {buys > 0 && (
            <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 8, background: "#10b98118", color: "#10b981", border: "1px solid #10b98130", fontWeight: 800, fontFamily: "var(--font-mono, monospace)" }}>
              BUY ×{buys}
            </span>
          )}
          {holds > 0 && (
            <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 8, background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b30", fontWeight: 800, fontFamily: "var(--font-mono, monospace)" }}>
              HOLD ×{holds}
            </span>
          )}
          {specs > 0 && (
            <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 8, background: "#8b5cf618", color: "#8b5cf6", border: "1px solid #8b5cf630", fontWeight: 800, fontFamily: "var(--font-mono, monospace)" }}>
              SPEC ×{specs}
            </span>
          )}
          <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
            sorted: verdict · fed · score · upside
          </span>
        </div>
      </div>

      {/* ── Card grid — grouped by theme ──────────────────────── */}
      {ranked.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <p style={{ fontSize: 15, margin: 0 }}>
            No reports yet. Run <code>/analyze TICKER</code> to generate one.
          </p>
        </div>
      ) : (
        <ThemeGroups ranked={ranked} driftMap={driftMap} />
      )}

      {/* ── Ranking Change section ─────────────────────────────── */}
      <RankingChangeTable rows={rankChanges} />

      {/* ── Catalyst Calendar ─────────────────────────────────── */}
      <CatalystCalendar events={calendarEvents} />
    </div>
  );
}
