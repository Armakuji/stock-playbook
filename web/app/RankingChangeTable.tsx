"use client";

import { useState } from "react";
import Link from "next/link";
import { RankChange } from "@/lib/ranking-history";
import { StockReport } from "@/lib/types";

const PAGE_SIZE = 5;

function Pagination({
  page, totalPages, onPrev, onNext,
}: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px",
      borderTop: "1px solid var(--border)",
      background: "var(--card)",
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
    }}>
      <button
        onClick={onPrev}
        disabled={page === 0}
        style={{
          fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 6,
          border: "1px solid var(--border)",
          background: page === 0 ? "transparent" : "var(--card)",
          color: page === 0 ? "var(--muted)" : "var(--text)",
          cursor: page === 0 ? "default" : "pointer",
          fontFamily: "var(--font-mono, monospace)",
          opacity: page === 0 ? 0.4 : 1,
          transition: "opacity 0.15s",
        }}
      >
        ← Prev
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {Array.from({ length: totalPages }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i === page ? 16 : 6, height: 6, borderRadius: 3,
              background: i === page ? "#10b981" : "var(--border)",
              transition: "all 0.2s ease",
            }}
          />
        ))}
      </div>

      <span style={{
        fontSize: 10, color: "var(--muted)",
        fontFamily: "var(--font-mono, monospace)",
        fontWeight: 700,
      }}>
        {page + 1} / {totalPages}
      </span>

      <button
        onClick={onNext}
        disabled={page >= totalPages - 1}
        style={{
          fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 6,
          border: "1px solid var(--border)",
          background: page >= totalPages - 1 ? "transparent" : "var(--card)",
          color: page >= totalPages - 1 ? "var(--muted)" : "var(--text)",
          cursor: page >= totalPages - 1 ? "default" : "pointer",
          fontFamily: "var(--font-mono, monospace)",
          opacity: page >= totalPages - 1 ? 0.4 : 1,
          transition: "opacity 0.15s",
        }}
      >
        Next →
      </button>
    </div>
  );
}

const VERDICT_COLORS: Record<StockReport["verdict"], string> = {
  BUY: "#10b981", HOLD: "#f59e0b", SELL: "#ef4444", SPECULATIVE: "#8b5cf6",
};
const CONFIDENCE_COLORS: Record<string, string> = {
  High: "#10b981", Medium: "#f59e0b", Low: "#ef4444",
};

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span style={{
        fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5,
        background: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f630",
        fontFamily: "var(--font-mono, monospace)",
      }}>NEW</span>
    );
  }
  if (delta === 0) {
    return <span style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>→</span>;
  }
  const up = delta > 0;
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5,
      background: up ? "#10b98118" : "#ef444418",
      color: up ? "#10b981" : "#ef4444",
      border: `1px solid ${up ? "#10b98130" : "#ef444430"}`,
      fontFamily: "var(--font-mono, monospace)",
    }}>
      {up ? `↑${delta}` : `↓${Math.abs(delta)}`}
    </span>
  );
}

export function RankingChangeTable({ rows }: { rows: RankChange[] }) {
  const [page, setPage] = useState(0);

  if (rows.length === 0) return null;

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div style={{ marginTop: 48 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>📈</span>
          <h2 style={{
            fontSize: "clamp(16px, 3vw, 22px)", fontWeight: 900, margin: 0,
            letterSpacing: "-0.5px", fontFamily: "var(--font-display, sans-serif)",
          }}>
            Ranking Change
          </h2>
        </div>
        <span style={{
          fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)",
          fontWeight: 700, padding: "3px 9px", borderRadius: 6,
          border: "1px solid var(--border)", background: "var(--card)",
        }}>
          {rows.length} stocks
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 16px", fontFamily: "var(--font-mono, monospace)" }}>
        vs. previous report snapshot · ↑ moved up · ↓ moved down · NEW = first appearance
      </p>

      <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%", borderCollapse: "collapse", minWidth: 640,
            fontFamily: "var(--font-mono, monospace)", fontSize: 12,
          }}>
            <thead>
              <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                {["Rank", "Δ Rank", "Stock", "Score", "Confidence", "Weeks Listed", "TP2 Upside", "Reason", "Source", ""].map((h) => (
                  <th key={h} style={{
                    padding: "10px 14px", textAlign: "left",
                    fontSize: 9, fontWeight: 800, color: "var(--muted)",
                    textTransform: "uppercase", letterSpacing: "1px", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, idx) => {
                const verdictColor = VERDICT_COLORS[row.verdict] ?? "#64748b";
                const confColor    = CONFIDENCE_COLORS[row.confidence] ?? "#64748b";
                const baseBg       = idx % 2 === 0 ? "transparent" : "#ffffff04";
                const isLast       = idx === pageRows.length - 1;
                return (
                  <tr
                    key={row.ticker}
                    style={{ background: baseBg, borderBottom: !isLast ? "1px solid var(--border)" : "none", transition: "background 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = `${verdictColor}08`; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = baseBg; }}
                  >
                    <td style={{ padding: "12px 14px", fontWeight: 800, fontSize: 13, color: "var(--text)" }}>#{row.currentRank}</td>
                    <td style={{ padding: "12px 14px" }}><DeltaBadge delta={row.delta} /></td>
                    <td style={{ padding: "12px 14px" }}>
                      <Link href={`/report/${row.ticker.toLowerCase()}`} style={{ textDecoration: "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 3, height: 28, borderRadius: 2, background: verdictColor, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13, color: verdictColor, fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.3px", textDecoration: "underline", textDecorationColor: `${verdictColor}55`, textUnderlineOffset: 3 }}>
                              {row.ticker}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1, fontFamily: "var(--font-body, sans-serif)" }}>
                              {row.companyName.split(" ").slice(0, 2).join(" ")}
                            </div>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: verdictColor }}>{row.score}</span>
                      <span style={{ color: "var(--muted)", fontSize: 10 }}>/100</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${confColor}18`, color: confColor, border: `1px solid ${confColor}30` }}>
                        {row.confidence}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", color: "var(--muted)", fontSize: 12 }}>{row.weeksInTop10}w</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontWeight: 800, color: "#10b981", fontSize: 13 }}>+{row.tp2Upside}%</span>
                    </td>
                    <td style={{ padding: "12px 14px", maxWidth: 220 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                        {row.reason}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", maxWidth: 200 }}>
                      {row.source ? (
                        <div>
                          <a href={row.source.url} target="_blank" rel="noopener noreferrer" style={{
                            fontSize: 11, color: "#3b82f6", textDecoration: "none", lineHeight: 1.4,
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                            fontFamily: "var(--font-body, sans-serif)",
                          }}>
                            {row.source.headline}
                          </a>
                          <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2, fontFamily: "var(--font-mono, monospace)" }}>
                            {row.source.date}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, color: "#374151", fontFamily: "var(--font-mono, monospace)", fontStyle: "italic" }}>
                          ไม่พบข่าวเฉพาะ — อาจเป็น sector-wide move
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <Link
                        href={`/report/${row.ticker.toLowerCase()}`}
                        style={{
                          fontSize: 11, fontWeight: 800,
                          padding: "4px 10px", borderRadius: 6,
                          background: `${verdictColor}15`,
                          color: verdictColor,
                          border: `1px solid ${verdictColor}35`,
                          textDecoration: "none",
                          fontFamily: "var(--font-mono, monospace)",
                          letterSpacing: "0.3px",
                          display: "inline-block",
                          transition: "background 0.15s",
                        }}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        />
      </div>
    </div>
  );
}
