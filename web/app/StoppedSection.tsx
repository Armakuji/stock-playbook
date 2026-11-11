"use client";

import { useState } from "react";

export interface StoppedRow {
  ticker: string;
  livePrice: number;
  hardStop: number;
  movePct: number;
  asOf: string;
}

// ── Stopped out — collapsed by default ──────────────────────────────────────
// Picks whose live price is at/below their own hard stop (web/lib/stop-status.ts).
// Pulled off the active board/top-N; the report is kept (backtest reads it) and
// stays reachable from here. A refresh that writes a new stop brings it back.
export function StoppedSection({ rows, th, hrefBase = "/report" }: { rows: StoppedRow[]; th: boolean; hrefBase?: string }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  return (
    <div style={{ marginTop: 28, borderRadius: 10, border: "1px solid #ef444430", overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: "9px 14px", background: "var(--card, #0e0508)", border: "none", cursor: "pointer",
          textAlign: "left", fontFamily: "var(--font-mono, monospace)",
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 800, color: "#ef4444", textTransform: "uppercase", letterSpacing: "1.5px" }}>
          {th ? "🛑 Stopped · ราคาหลุด hard stop แล้ว — ออกจากบอร์ด" : "🛑 Stopped · live price below hard stop — off the board"}
        </span>
        <span style={{
          fontSize: 9, color: "#ef4444", padding: "1px 7px", borderRadius: 5,
          background: "#ef444412", border: "1px solid #ef444430",
        }}>
          {rows.length}
        </span>
        <span style={{
          marginLeft: "auto", fontSize: 10, color: "var(--muted, #7f3030)", flexShrink: 0,
          transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease",
        }}>
          ▼
        </span>
      </button>

      {open && (
        <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 8, borderTop: "1px solid #ef444430" }}>
          {rows.map((r) => (
            <a key={r.ticker} href={`${hrefBase}/${r.ticker.toLowerCase()}`}
              title={th
                ? `ราคาล่าสุด $${r.livePrice} ≤ hard stop $${r.hardStop} (ณ ${r.asOf.slice(0, 10)})`
                : `Live $${r.livePrice} ≤ hard stop $${r.hardStop} (as of ${r.asOf.slice(0, 10)})`}
              style={{
                display: "flex", alignItems: "center", gap: 8, textDecoration: "none",
                padding: "6px 12px", borderRadius: 8, background: "var(--card, #0e0508)",
                border: "1px solid var(--border, #2d1010)", opacity: 0.8,
                fontFamily: "var(--font-mono, monospace)", fontSize: 12,
              }}>
              <span style={{ fontWeight: 800, color: "var(--text, #fff)" }}>{r.ticker}</span>
              <span style={{ fontSize: 10, color: "var(--muted, #7f3030)" }}>${r.livePrice} / stop ${r.hardStop}</span>
              <span style={{
                fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 5,
                background: "#ef444418", color: "#ef4444", border: "1px solid #ef444430",
              }}>
                {r.movePct > 0 ? "+" : ""}{r.movePct}%
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
