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
const RISK_COLORS: Record<Week["risk"], { badge: string; label: string; labelTh: string }> = {
  high:   { badge: "#f87171", label: "High risk", labelTh: "เสี่ยงสูง" },
  medium: { badge: "#fbbf24", label: "Caution",   labelTh: "ระวัง"    },
  entry:  { badge: "#34d399", label: "Entry",     labelTh: "เข้าได้"   },
  wait:   { badge: "#94a3b8", label: "Wait",      labelTh: "รอ"       },
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
  green:  "#34d399",
  red:    "#f87171",
  yellow: "#fbbf24",
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
        <div className="mt-drawer" style={{ borderBottom: `1px solid ${vs.drawerBorder}`, background: "var(--card)" }}>
          <div className="mt-wrap">

            {/* Read (left) · decide (right) */}
            <div className="mt-top">
              <div>
                <p className="mt-summary">{summaryText}</p>

                <h3 className="mt-h">{th ? "ถ้าเกิดสิ่งนี้" : "If this happens"}</h3>
                <ul className="mt-if">
                  {data.decisionTree.map((dt, i) => (
                    <li key={i}>
                      <span className="mt-if-cond">{dt.condition}</span>
                      <span className="mt-if-act" style={{ color: DECISION_COLOR[dt.color] }}>{dt.action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <aside className="mt-side">
                <div className="mt-entry">
                  <h3 className="mt-h" style={{ marginTop: 0 }}>
                    {th ? "ช่วงเข้าซื้อ" : "Entry window"}
                    {inEntryWindow && <span className="mt-live">{th ? "เปิดอยู่" : "open now"}</span>}
                  </h3>
                  <div className="mt-entry-label">{data.entryWindow.label}</div>
                  <p className="mt-entry-cond">{entryConditionText}</p>
                </div>

                <h3 className="mt-h">{th ? "ตัวเลขมหภาค" : "Macro"}</h3>
                <dl className="mt-macro">
                  {[
                    { label: "Fed",                           value: data.macroSnapshot.fedRate },
                    { label: "PCE",                           value: data.macroSnapshot.pce },
                    { label: "VIX",                           value: data.macroSnapshot.vix },
                    { label: th ? "FOMC ถัดไป" : "Next FOMC", value: data.macroSnapshot.nextFomc },
                    { label: th ? "เทรนด์" : "Trend",         value: data.macroSnapshot.marketTrend },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </aside>
            </div>

            {/* Week by week */}
            <h3 className="mt-h" style={{ marginTop: 22 }}>{th ? "รายสัปดาห์" : "Week by week"}</h3>
            <ol className="mt-weeks">
              {data.weeks.map((week, i) => {
                const rc = RISK_COLORS[week.risk];
                return (
                  <li key={i} className="mt-week">
                    <span className="mt-week-date">{week.label}</span>
                    <span className="mt-week-risk" style={{ color: rc.badge }}>
                      <span className="mt-dot" style={{ background: rc.badge }} />
                      {th ? rc.labelTh : rc.label}
                    </span>
                    <div className="mt-week-body">
                      <div className="mt-week-events">
                        {week.events.map((ev, j) => (
                          <span key={j} className={ev.chip === "red" ? "is-hot" : undefined}>{ev.name}</span>
                        ))}
                      </div>
                      <div className="mt-week-action">{th ? (week.actionTh || week.action) : week.action}</div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-updated">{th ? "อัปเดต" : "Updated"} {generatedDate}</div>
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

        /* ── Drawer: sans for reading, mono only for dates/numbers ── */
        .mt-drawer { font-family: var(--font-body, system-ui, sans-serif); }
        .mt-wrap { max-width: 1200px; margin: 0 auto; padding: 18px 16px 14px; }
        .mt-top { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 36px; align-items: start; }
        .mt-summary { margin: 0; max-width: 68ch; font-size: 13.5px; line-height: 1.65; color: var(--text); }
        .mt-h { margin: 18px 0 8px; font-size: 12px; font-weight: 600; color: var(--muted); letter-spacing: 0; display: flex; align-items: center; gap: 8px; }
        .mt-if { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; max-width: 68ch; }
        .mt-if li { font-size: 12.5px; line-height: 1.5; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; padding: 5px 0; border-top: 1px solid var(--border); }
        .mt-if li:first-child { border-top: none; padding-top: 0; }
        .mt-if-cond { color: var(--muted); }
        .mt-if-act { font-weight: 600; }
        .mt-side { border-left: 1px solid var(--border); padding-left: 24px; }
        .mt-entry-label { font-family: var(--font-mono, monospace); font-size: 15px; font-weight: 700; color: #34d399; line-height: 1.4; }
        .mt-entry-cond { margin: 6px 0 0; font-size: 12.5px; line-height: 1.55; color: var(--muted); }
        .mt-live { font-size: 10.5px; font-weight: 600; color: #34d399; background: rgba(52,211,153,0.12); padding: 1px 7px; border-radius: 99px; }
        .mt-macro { margin: 0; display: grid; gap: 4px; }
        .mt-macro > div { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 10px; font-size: 12.5px; line-height: 1.45; }
        .mt-macro dt { color: var(--muted); }
        .mt-macro dd { margin: 0; color: var(--text); font-family: var(--font-mono, monospace); font-size: 12px; }
        .mt-weeks { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--border); }
        .mt-week { display: grid; grid-template-columns: 116px 104px minmax(0, 1fr); gap: 14px; align-items: baseline; padding: 9px 0; border-bottom: 1px solid var(--border); }
        .mt-week-date { font-family: var(--font-mono, monospace); font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; }
        .mt-week-risk { font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
        .mt-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .mt-week-events { font-size: 12.5px; color: var(--muted); display: flex; flex-wrap: wrap; column-gap: 14px; row-gap: 2px; }
        .mt-week-events .is-hot { color: #f87171; }
        .mt-week-action { font-size: 13px; color: var(--text); line-height: 1.5; margin-top: 2px; max-width: 80ch; }
        .mt-updated { margin-top: 10px; font-size: 11px; color: var(--muted); }
        @media (max-width: 860px) {
          .mt-top { grid-template-columns: minmax(0, 1fr); gap: 4px; }
          .mt-side { border-left: none; padding-left: 0; border-top: 1px solid var(--border); padding-top: 14px; margin-top: 14px; }
          .mt-if li { grid-template-columns: minmax(0, 1fr); gap: 2px; }
        }
        @media (max-width: 640px) {
          .mt-week { grid-template-columns: auto minmax(0, 1fr); row-gap: 4px; }
          .mt-week-body { grid-column: 1 / -1; }
        }
      `}</style>
    </div>
  );
}
