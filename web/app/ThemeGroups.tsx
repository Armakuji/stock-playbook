"use client";

import { StockReport } from "@/lib/types";
import { StockCard } from "./StockCard";
import {
  primaryCatalystType, catalystTypeMeta, daysToCatalyst,
} from "@/lib/catalyst-timing";

// ── Concentration warning thresholds ────────────────────────────────────────
// % of total stocks whose primary catalyst is the SAME event type.
const WARN_YELLOW = 0.5;   // ≥50% of watchlist on one event type
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

  // Group by PRIMARY catalyst type — the thing that actually decides the +30%,
  // not which value chain the company sits in.
  const groups: Record<string, RankedReport[]> = {};
  for (const r of ranked) {
    const type = primaryCatalystType(r);
    (groups[type] ??= []).push(r);
  }

  // Order groups by soonest catalyst in the group (this is a near-term hunter),
  // tie-break by average conviction score.
  const minDays = (cards: RankedReport[]) =>
    Math.min(...cards.map((c) => daysToCatalyst(c) ?? Infinity));
  const avg = (cards: RankedReport[]) =>
    cards.reduce((s, r) => s + (r.score ?? 0), 0) / cards.length;

  const sortedTypes = Object.keys(groups).sort((a, b) => {
    const da = minDays(groups[a]), db = minDays(groups[b]);
    if (da !== db) return da - db;
    return avg(groups[b]) - avg(groups[a]);
  });

  let cardIdx = 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {sortedTypes.map((type) => {
        const cards = groups[type];
        const meta = catalystTypeMeta(type);
        const avgScore = Math.round(avg(cards));
        const soonest = minDays(cards);
        const ratio = cards.length / total;
        const headerBorderColor =
          ratio >= WARN_RED    ? "#ef4444" :
          ratio >= WARN_YELLOW ? "#f59e0b" :
          "var(--border-bright)";
        const concentrationWarning =
          ratio >= WARN_RED    ? `⚠️ ${Math.round(ratio * 100)}% of watchlist on one event type — correlated risk` :
          ratio >= WARN_YELLOW ? `⚡ ${Math.round(ratio * 100)}% on this event type` :
          null;

        return (
          <div key={type}>
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15 }}>{meta.icon}</span>
                <span style={{
                  fontSize: 13, fontWeight: 800, color: "var(--text)",
                  fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.3px",
                }}>
                  {meta.label}
                </span>
                <span style={{
                  fontSize: 10, color: "var(--muted)", padding: "1px 7px",
                  borderRadius: 5, background: "#ffffff08",
                  border: "1px solid var(--border)",
                  fontFamily: "var(--font-mono, monospace)",
                }}>
                  {cards.length} stock{cards.length > 1 ? "s" : ""}
                </span>
                {Number.isFinite(soonest) && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 5,
                    background: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f630",
                    fontFamily: "var(--font-mono, monospace)",
                  }}>
                    ⏱ next {soonest <= 0 ? "today" : `${soonest}d`}
                  </span>
                )}
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
