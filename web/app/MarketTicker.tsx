"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/LanguageContext";

// Reading-paced crawl: px/sec chosen so a stock-ticker-style line is
// comfortably readable, not a blur. Duration is derived from measured
// content width so it stays this pace regardless of how much news there is.
const CRAWL_PX_PER_SEC = 45;

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
  actionTh?: string;
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
  summaryTh?: string;
  entryWindow: { start: string; end: string; label: string; condition: string; conditionTh?: string };
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

const VERDICT_STYLE: Record<MarketTimingData["verdict"], {
  color: string; emoji: string;
  barBg: string; barBorder: string;
  pillBg: string; pillBorder: string;
  drawerBorder: string;
}> = {
  BUY: {
    color: "#10b981", emoji: "🟢",
    barBg: "rgba(16,185,129,0.07)", barBorder: "rgba(16,185,129,0.22)",
    pillBg: "rgba(16,185,129,0.12)", pillBorder: "rgba(16,185,129,0.4)",
    drawerBorder: "rgba(16,185,129,0.18)",
  },
  SELECTIVE: {
    color: "#f59e0b", emoji: "🟡",
    barBg: "rgba(245,158,11,0.07)", barBorder: "rgba(245,158,11,0.22)",
    pillBg: "rgba(245,158,11,0.12)", pillBorder: "rgba(245,158,11,0.4)",
    drawerBorder: "rgba(245,158,11,0.18)",
  },
  WAIT: {
    color: "#ef4444", emoji: "🔴",
    barBg: "rgba(239,68,68,0.07)", barBorder: "rgba(239,68,68,0.22)",
    pillBg: "rgba(239,68,68,0.12)", pillBorder: "rgba(239,68,68,0.4)",
    drawerBorder: "rgba(239,68,68,0.18)",
  },
};

const DECISION_COLOR: Record<DecisionItem["color"], string> = {
  green:  "#10b981",
  red:    "#ef4444",
  yellow: "#f59e0b",
};

// ── Component ─────────────────────────────────────────────────────────
export function MarketTicker({ data }: { data: MarketTimingData | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState(60);
  const crawlRef = useRef<HTMLDivElement>(null);
  const { lang } = useLang();
  const th = lang === "th";

  // Measure the (single, un-duplicated) content width and derive a duration
  // that holds a constant, readable px/sec pace instead of a fixed seconds
  // value that reads too fast when there's little news and crawls forever
  // when there's a lot.
  useEffect(() => {
    const el = crawlRef.current;
    if (!el) return;
    const measure = () => {
      const singleWidth = el.scrollWidth / 2;
      setDuration(Math.max(singleWidth / CRAWL_PX_PER_SEC, 20));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [data]);

  if (!data) return null;

  const vs = VERDICT_STYLE[data.verdict];
  const generatedDate = new Date(data.generatedAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  const verdictLabelText = th ? data.verdictLabel : data.verdict;
  const summaryText = th ? (data.summaryTh || data.summary) : data.summary;
  const entryConditionText = th ? (data.entryWindow.conditionTh || data.entryWindow.condition) : data.entryWindow.condition;

  // Is there a current entry window active?
  const now = new Date();
  const entryStart = new Date(data.entryWindow.start + "T00:00:00Z");
  const entryEnd   = new Date(data.entryWindow.end   + "T23:59:59Z");
  const inEntryWindow = now >= entryStart && now <= entryEnd;

  // Flatten the calendar into a single crawl: every dated event in order,
  // plus the macro snapshot. The free-text `summary` is deliberately NOT
  // included here — it reads as a paragraph, not a ticker item, and only
  // belongs in the click-to-expand drawer below.
  const crawlItems: { text: string; color: string }[] = [
    ...data.weeks.flatMap((w) => w.events.map((e) => ({ text: e.name, color: CHIP_COLORS[e.chip].text }))),
    { text: `Fed ${data.macroSnapshot.fedRate}`, color: "var(--muted)" },
    { text: `PCE ${data.macroSnapshot.pce}`, color: "var(--muted)" },
    { text: `VIX ${data.macroSnapshot.vix}`, color: "var(--muted)" },
  ];

  const Crawl = () => (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {crawlItems.map((item, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
          {i > 0 && <span style={{ color: "var(--border-bright)", margin: "0 14px" }}>•</span>}
          <span style={{ color: item.color }}>{item.text}</span>
        </span>
      ))}
    </span>
  );

  return (
    <div style={{ fontFamily: "var(--font-mono, monospace)" }}>

      {/* ── Ticker bar — full-bleed, fused directly under the header ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="srw-ticker-bar"
        style={{
          display: "flex", alignItems: "center", width: "100%",
          background: vs.barBg, borderBottom: `1px solid ${vs.barBorder}`,
          border: "none", borderBottomWidth: 1, cursor: "pointer", textAlign: "left", padding: 0,
        }}
      >
        <div style={{ maxWidth: 1200, width: "100%", margin: "0 auto", display: "flex", alignItems: "center", gap: 12, padding: "7px 16px" }}>

          {/* Verdict pill — the one fixed, non-scrolling fact */}
          <span style={{
            fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 6,
            background: vs.pillBg, color: vs.color, border: `1px solid ${vs.pillBorder}`,
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
            {vs.emoji} {verdictLabelText.toUpperCase()}
          </span>

          {/* Scrolling news crawl */}
          <div className="srw-ticker-track" style={{ flex: 1, overflow: "hidden", position: "relative", minWidth: 0 }}>
            <div ref={crawlRef} className={`srw-ticker-crawl${open ? " is-open" : ""}`} style={{
              display: "inline-flex", whiteSpace: "nowrap", fontSize: 11.5,
              animationDuration: `${duration}s`,
            }}>
              <Crawl /><span style={{ color: "var(--border-bright)", margin: "0 14px" }}>•</span><Crawl />
            </div>
          </div>

          {/* Entry window — fixed right bookend */}
          <span className="srw-ticker-entry" style={{
            fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5,
            background: inEntryWindow ? "rgba(16,185,129,0.15)" : "rgba(56,189,248,0.10)",
            color: inEntryWindow ? "#10b981" : "#38bdf8",
            border: `1px solid ${inEntryWindow ? "rgba(16,185,129,0.35)" : "rgba(56,189,248,0.28)"}`,
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
            {inEntryWindow ? "🎯 ENTRY NOW" : "Entry"} {data.entryWindow.label}
          </span>

          {/* Chevron */}
          <span style={{
            fontSize: 10, color: "var(--muted)", flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease", display: "inline-block",
          }}>▼</span>
        </div>
      </button>

      {/* ── Expanded drawer ─────────────────────────────────────── */}
      {open && (
        <div style={{ borderBottom: `1px solid ${vs.drawerBorder}`, background: "var(--card)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>

            {/* Summary + entry window — always stacked (TH summary is long; side-by-side flex broke layout) */}
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 11, color: "var(--text)", lineHeight: 1.7 }}>
                {summaryText}
              </div>
              <div style={{
                alignSelf: "center",
                width: "100%",
                maxWidth: 360,
                padding: "9px 16px",
                borderRadius: 9,
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.25)",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 9, color: "#10b981", fontWeight: 800, letterSpacing: "1px", marginBottom: 4 }}>
                  🎯 BEST ENTRY WINDOW
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}>
                  {data.entryWindow.label}
                </div>
                <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
                  {entryConditionText}
                </div>
              </div>
            </div>

            {/* Event Risk Calendar table */}
            <div style={{ padding: "0 16px 12px" }}>
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
                        {th ? (week.actionTh || week.action) : week.action}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Decision tree + macro snapshot side by side */}
            <div style={{ padding: "0 16px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>

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

            <div style={{ padding: "0 16px 12px", fontSize: 9, color: "var(--muted)" }}>
              upd. {generatedDate}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .srw-ticker-crawl {
          animation-name: tickerCrawl;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .srw-ticker-crawl.is-open,
        .srw-ticker-bar:hover .srw-ticker-crawl {
          animation-play-state: paused;
        }
        @media (max-width: 640px) {
          .srw-ticker-entry { display: none; }
        }
      `}</style>
    </div>
  );
}
