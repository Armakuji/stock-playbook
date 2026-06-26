"use client";

import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────
interface WeekEvent {
  name: string;
  chip: "red" | "yellow" | "green" | "blue" | "grey";
}

interface Week {
  label: string;
  dateStart: string;
  events: WeekEvent[];
  risk: "high" | "medium" | "entry" | "wait";
  action: string;
}

interface DecisionItem {
  condition: string;
  action: string;
  color: "green" | "red" | "yellow";
}

interface MarketTimingData {
  generatedAt: string;
  verdict: "BUY" | "SELECTIVE" | "WAIT";
  verdictLabel: string;
  summary: string;
  entryWindow: { start: string; end: string; label: string; condition: string };
  weeks: Week[];
  macroSnapshot: {
    fedRate: string;
    pce: string;
    vix: string;
    nextFomc: string;
    marketTrend: string;
  };
  decisionTree: DecisionItem[];
}

// ── Colour maps ───────────────────────────────────────────────────────
const RISK_COLORS: Record<Week["risk"], { bg: string; border: string; badge: string; label: string }> = {
  high:   { bg: "rgba(239,68,68,0.06)",  border: "#ef4444", badge: "#ef4444", label: "🔴 HIGH"  },
  medium: { bg: "rgba(245,158,11,0.06)", border: "#f59e0b", badge: "#f59e0b", label: "⚠️ MED"   },
  entry:  { bg: "rgba(16,185,129,0.08)", border: "#10b981", badge: "#10b981", label: "✅ ENTRY" },
  wait:   { bg: "rgba(148,163,184,0.06)",border: "#475569", badge: "#94a3b8", label: "⏸ WAIT"  },
};

const CHIP_COLORS: Record<WeekEvent["chip"], { bg: string; text: string; border: string }> = {
  red:    { bg: "rgba(239,68,68,0.15)",   text: "#ef4444", border: "rgba(239,68,68,0.35)"   },
  yellow: { bg: "rgba(245,158,11,0.15)",  text: "#f59e0b", border: "rgba(245,158,11,0.35)"  },
  green:  { bg: "rgba(16,185,129,0.15)",  text: "#10b981", border: "rgba(16,185,129,0.35)"  },
  blue:   { bg: "rgba(56,189,248,0.15)",  text: "#38bdf8", border: "rgba(56,189,248,0.35)"  },
  grey:   { bg: "rgba(148,163,184,0.10)", text: "#94a3b8", border: "rgba(148,163,184,0.25)" },
};

const VERDICT_STYLE: Record<MarketTimingData["verdict"], { color: string; bg: string; border: string; emoji: string }> = {
  BUY:       { color: "#10b981", bg: "rgba(16,185,129,0.10)",  border: "#10b981", emoji: "🟢" },
  SELECTIVE: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "#f59e0b", emoji: "🟡" },
  WAIT:      { color: "#ef4444", bg: "rgba(239,68,68,0.10)",   border: "#ef4444", emoji: "🔴" },
};

const DECISION_COLOR: Record<DecisionItem["color"], string> = {
  green:  "#10b981",
  red:    "#ef4444",
  yellow: "#f59e0b",
};

// ── Component ─────────────────────────────────────────────────────────
export function MarketTimingPanel({ data }: { data: MarketTimingData }) {
  const [open, setOpen] = useState(false);

  const vs = VERDICT_STYLE[data.verdict];
  const generatedDate = new Date(data.generatedAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  // Is there a current entry window active?
  const now = new Date();
  const entryStart = new Date(data.entryWindow.start + "T00:00:00Z");
  const entryEnd   = new Date(data.entryWindow.end   + "T23:59:59Z");
  const inEntryWindow = now >= entryStart && now <= entryEnd;

  return (
    <div style={{
      marginBottom: 16,
      borderRadius: 10,
      border: `1px solid ${vs.border}35`,
      fontFamily: "var(--font-mono, monospace)",
      overflow: "hidden",
    }}>

      {/* ── Collapsed header (always visible) ──────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          width: "100%", padding: "9px 14px",
          background: vs.bg, border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        {/* Verdict pill */}
        <span style={{
          fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 6,
          background: vs.bg, color: vs.color, border: `1px solid ${vs.border}50`,
          flexShrink: 0,
        }}>
          {vs.emoji} MARKET · {data.verdictLabel.toUpperCase()}
        </span>

        {/* Entry window chip */}
        {inEntryWindow ? (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
            background: "rgba(16,185,129,0.15)", color: "#10b981",
            border: "1px solid rgba(16,185,129,0.35)", flexShrink: 0,
          }}>
            🎯 ENTRY WINDOW NOW: {data.entryWindow.label}
          </span>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
            background: "rgba(56,189,248,0.10)", color: "#38bdf8",
            border: "1px solid rgba(56,189,248,0.25)", flexShrink: 0,
          }}>
            Entry: {data.entryWindow.label}
          </span>
        )}

        {/* Next FOMC */}
        <span style={{ fontSize: 10, color: "var(--muted)", flex: 1 }}>
          FOMC {data.macroSnapshot.nextFomc} · Fed {data.macroSnapshot.fedRate} · PCE {data.macroSnapshot.pce}
        </span>

        {/* Updated date */}
        <span style={{ fontSize: 9, color: "var(--muted)", flexShrink: 0 }}>
          upd. {generatedDate}
        </span>

        {/* Chevron */}
        <span style={{
          fontSize: 10, color: "var(--muted)", flexShrink: 0,
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease", display: "inline-block",
        }}>▼</span>
      </button>

      {/* ── Expanded body ───────────────────────────────────────── */}
      {open && (
        <div style={{ borderTop: `1px solid ${vs.border}20`, background: "var(--card)" }}>

          {/* Summary + entry window */}
          <div style={{ padding: "12px 14px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, color: "var(--text)", lineHeight: 1.7 }}>
                {data.summary}
              </div>
            </div>
            <div style={{
              minWidth: 160, padding: "10px 14px", borderRadius: 8,
              background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 9, color: "#10b981", fontWeight: 800, letterSpacing: "1px", marginBottom: 4 }}>
                🎯 BEST ENTRY WINDOW
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}>
                {data.entryWindow.label}
              </div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
                {data.entryWindow.condition}
              </div>
            </div>
          </div>

          {/* Event Risk Calendar table */}
          <div style={{ padding: "0 14px 12px" }}>
            <div style={{
              fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase",
              letterSpacing: "1px", marginBottom: 6,
            }}>
              📅 EVENT RISK CALENDAR
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
              {data.weeks.map((week, i) => {
                const rc = RISK_COLORS[week.risk];
                return (
                  <div key={i} style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr auto auto",
                    gap: 8, alignItems: "center",
                    padding: "7px 10px",
                    background: rc.bg,
                    borderLeft: `3px solid ${rc.border}`,
                    borderBottom: i < data.weeks.length - 1 ? "1px solid var(--border)" : "none",
                  }}>
                    {/* Week label */}
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>
                      {week.label}
                    </div>

                    {/* Event chips */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {week.events.map((ev, j) => {
                        const cc = CHIP_COLORS[ev.chip];
                        return (
                          <span key={j} style={{
                            fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 4,
                            background: cc.bg, color: cc.text, border: `1px solid ${cc.border}`,
                            whiteSpace: "nowrap",
                          }}>
                            {ev.name}
                          </span>
                        );
                      })}
                    </div>

                    {/* Risk badge */}
                    <div style={{
                      fontSize: 9, fontWeight: 800, color: rc.badge, whiteSpace: "nowrap",
                    }}>
                      {rc.label}
                    </div>

                    {/* Action */}
                    <div style={{ fontSize: 9, color: "var(--muted)", whiteSpace: "nowrap", textAlign: "right" }}>
                      {week.action}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Decision tree + macro snapshot side by side */}
          <div style={{ padding: "0 14px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>

            {/* Decision tree */}
            <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>
                IF / THEN
              </div>
              {data.decisionTree.map((dt, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6, fontSize: 10 }}>
                  <span style={{ color: "var(--muted)", flexShrink: 0, marginTop: 1 }}>→</span>
                  <div>
                    <span style={{ color: "var(--text)" }}>{dt.condition}</span>
                    {" "}
                    <span style={{ fontWeight: 800, color: DECISION_COLOR[dt.color] }}>{dt.action}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Macro snapshot */}
            <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>
                MACRO SNAPSHOT
              </div>
              {[
                { label: "Fed Rate",    value: data.macroSnapshot.fedRate    },
                { label: "PCE",         value: data.macroSnapshot.pce        },
                { label: "VIX",         value: data.macroSnapshot.vix        },
                { label: "Next FOMC",   value: data.macroSnapshot.nextFomc   },
                { label: "Trend",       value: data.macroSnapshot.marketTrend },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 10 }}>
                  <span style={{ color: "var(--muted)" }}>{label}</span>
                  <span style={{ color: "var(--text)", fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
