"use client";

import { StockReport } from "@/lib/types";
import { StockCard } from "./StockCard";

// ── Theme map: ticker → theme label ─────────────────────────────────────────
// Extend this as new tickers are added
const TICKER_THEME: Record<string, string> = {
  NVDA: "AI Power Chain",
  AVGO: "AI Power Chain",
  INTC: "AI Power Chain",
  AMD:  "AI Power Chain",
  TSM:  "AI Power Chain",
  TSLA: "Small-cap AI / Tech / Catalyst Plays",
  ASTS: "Small-cap AI / Tech / Catalyst Plays",
  PLTR: "Small-cap AI / Tech / Catalyst Plays",
  RKLB: "Small-cap AI / Tech / Catalyst Plays",
};

const THEME_ORDER = [
  "AI Power Chain",
  "Small-cap AI / Tech / Catalyst Plays",
  "Biotech / Pharma Binary Catalyst",
  "Other",
];

const THEME_ICONS: Record<string, string> = {
  "AI Power Chain":                       "⚡",
  "Small-cap AI / Tech / Catalyst Plays": "🚀",
  "Biotech / Pharma Binary Catalyst":     "🧬",
  "Other":                                "📦",
};

// ── Concentration warning thresholds ────────────────────────────────────────
// % of total stocks in a single group
const WARN_YELLOW = 0.5;   // ≥50% of watchlist in one group
const WARN_RED    = 0.7;   // ≥70%

type RankedReport = StockReport & { rank: number; rankScore: number };

export function ThemeGroups({
  ranked,
  driftMap,
}: {
  ranked: RankedReport[];
  driftMap: Record<string, number | null>;
}) {
  const total = ranked.length;

  // Group by theme
  const groups: Record<string, RankedReport[]> = {};
  for (const r of ranked) {
    const theme = TICKER_THEME[r.ticker] ?? "Other";
    if (!groups[theme]) groups[theme] = [];
    groups[theme].push(r);
  }

  // Sort themes by THEME_ORDER, then alphabetically for unknowns
  const sortedThemes = [
    ...THEME_ORDER.filter((t) => groups[t]),
    ...Object.keys(groups).filter((t) => !THEME_ORDER.includes(t)).sort(),
  ];

  let cardIdx = 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {sortedThemes.map((theme) => {
        const cards = groups[theme];
        const avgScore = Math.round(cards.reduce((s, r) => s + (r.score ?? 0), 0) / cards.length);
        const ratio = cards.length / total;
        const headerBorderColor =
          ratio >= WARN_RED    ? "#ef4444" :
          ratio >= WARN_YELLOW ? "#f59e0b" :
          "var(--border-bright)";
        const concentrationWarning =
          ratio >= WARN_RED    ? `⚠️ Concentration ${Math.round(ratio * 100)}% — high sector risk` :
          ratio >= WARN_YELLOW ? `⚡ ${Math.round(ratio * 100)}% of watchlist in this theme` :
          null;

        return (
          <div key={theme}>
            {/* Group header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexWrap: "wrap", gap: 8,
              padding: "10px 14px",
              marginBottom: 12,
              background: "var(--card)",
              border: `1px solid ${headerBorderColor}`,
              borderLeft: `3px solid ${headerBorderColor}`,
              borderRadius: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15 }}>{THEME_ICONS[theme] ?? "📦"}</span>
                <span style={{
                  fontSize: 13, fontWeight: 800, color: "var(--text)",
                  fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.3px",
                }}>
                  {theme}
                </span>
                <span style={{
                  fontSize: 10, color: "var(--muted)", padding: "1px 7px",
                  borderRadius: 5, background: "#ffffff08",
                  border: "1px solid var(--border)",
                  fontFamily: "var(--font-mono, monospace)",
                }}>
                  {cards.length} stock{cards.length > 1 ? "s" : ""}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "1px 7px",
                  borderRadius: 5,
                  background: avgScore >= 75 ? "#10b98118" : avgScore >= 55 ? "#f59e0b18" : "#ef444418",
                  color:      avgScore >= 75 ? "#10b981"   : avgScore >= 55 ? "#f59e0b"   : "#ef4444",
                  border: `1px solid ${avgScore >= 75 ? "#10b98130" : avgScore >= 55 ? "#f59e0b30" : "#ef444430"}`,
                  fontFamily: "var(--font-mono, monospace)",
                }}>
                  avg {avgScore}
                </span>
              </div>
              {concentrationWarning && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: ratio >= WARN_RED ? "#ef4444" : "#f59e0b",
                  fontFamily: "var(--font-mono, monospace)",
                }}>
                  {concentrationWarning}
                </span>
              )}
            </div>

            {/* Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {cards.map((r) => {
                const delay = cardIdx++ * 0.07;
                return (
                  <div key={`${r.ticker}-${r.generatedAt}`} style={{ animation: `cardIn 0.4s ease ${delay}s both` }}>
                    <StockCard
                      report={r}
                      rank={r.rank}
                      rankScore={r.rankScore}
                      scoreDrift={driftMap[r.ticker] ?? null}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
