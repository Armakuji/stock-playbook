"use client";

import { useState } from "react";
import { FactorExposure } from "@/lib/factors";
import { useLang } from "@/lib/LanguageContext";

export function FactorRiskPanel({ risks }: { risks: FactorExposure[] }) {
  const [open, setOpen] = useState(false);
  const { lang } = useLang();
  const th = lang === "th";

  if (risks.length === 0) return null;

  const maxRatio = Math.max(...risks.map((f) => f.ratio));
  const maxRed = maxRatio >= 0.7;
  const accentColor = maxRed ? "#ef4444" : "#f59e0b";

  return (
    <div
      style={{
        marginBottom: 12,
        borderRadius: 8,
        border: `1px solid ${accentColor}28`,
        fontFamily: "var(--font-mono, monospace)",
        overflow: "hidden",
      }}
    >
      {/* ── Header (always visible) ─────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "7px 12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {/* Icon + label */}
        <span style={{ fontSize: 10, fontWeight: 800, color: accentColor, flexShrink: 0 }}>
          ⚡ {th ? "ความเสี่ยง FACTOR" : "FACTOR RISK"}
        </span>

        {/* Factor chips */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", flex: 1 }}>
          {risks.map((f) => {
            const red = f.ratio >= 0.7;
            const c = red ? "#ef4444" : f.ratio >= 0.5 ? "#f59e0b" : "#94a3b8";
            return (
              <span
                key={f.factor}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "1px 7px",
                  borderRadius: 4,
                  background: `${c}10`,
                  border: `1px solid ${c}28`,
                  fontSize: 9,
                  color: c,
                  fontWeight: 700,
                }}
              >
                {f.icon} {f.tickers.length} · {Math.round(f.ratio * 100)}%
              </span>
            );
          })}
        </div>

        {/* Chevron */}
        <span
          style={{
            fontSize: 10,
            color: "var(--muted)",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            display: "inline-block",
          }}
        >
          ▼
        </span>
      </button>

      {/* ── Expanded body ───────────────────────────────────── */}
      {open && (
        <div
          style={{
            borderTop: `1px solid ${accentColor}18`,
            padding: "8px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {risks.map((f) => {
            const red = f.ratio >= 0.7;
            const c = red ? "#ef4444" : "#f59e0b";
            return (
              <div
                key={f.factor}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  fontSize: 11,
                }}
              >
                <span style={{ color: c, fontWeight: 800, flexShrink: 0 }}>
                  {f.icon} {f.label}
                </span>
                <span style={{ color: "var(--text)", fontWeight: 600 }}>
                  {f.tickers.join(" · ")}
                </span>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>
                  {th
                    ? `${f.tickers.length} ตัว · ${Math.round(f.ratio * 100)}% ของ book`
                    : `${f.tickers.length} pick · ${Math.round(f.ratio * 100)}% of book`}
                  {f.ratio >= 0.5 &&
                    (th
                      ? " — เคลื่อนไหวพร้อมกันบนข่าว factor เดียว"
                      : " — moves together on a single factor's news")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
