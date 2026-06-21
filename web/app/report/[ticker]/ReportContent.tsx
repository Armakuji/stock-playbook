"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StockReport, Catalyst, EntryLevel, Scenario, EstimateDate, CatalystSpot, ComparableCase } from "@/lib/types";
import { applyTranslation, Lang } from "@/lib/i18n";

// ─── Color maps ───────────────────────────────────────────────────────────────

const VERDICT_COLORS: Record<StockReport["verdict"], string> = {
  BUY: "#10b981",
  HOLD: "#f59e0b",
  SELL: "#ef4444",
  SPECULATIVE: "#8b5cf6",
};

const DOT_COLORS: Record<string, string> = {
  red: "#ef4444", yellow: "#f59e0b", green: "#10b981", gray: "#64748b",
};

const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  red:    { bg: "#ef444422", color: "#ef4444" },
  yellow: { bg: "#f59e0b22", color: "#f59e0b" },
  green:  { bg: "#10b98122", color: "#10b981" },
  blue:   { bg: "#3b82f622", color: "#3b82f6" },
};

const SCENARIO_COLORS: Record<string, { bar: string; text: string }> = {
  red:    { bar: "#ef4444", text: "#ef4444" },
  yellow: { bar: "#f59e0b", text: "#f59e0b" },
  green:  { bar: "#10b981", text: "#10b981" },
  purple: { bar: "#8b5cf6", text: "#c4b5fd" },
};

const RISK_COLOR: Record<string, string> = {
  LOW: "#10b981", MEDIUM: "#f59e0b", HIGH: "#ef4444",
};

// Spot-mode accent (purple → amber) — deliberately distinct from the green Core tone
const SPOT_PURPLE = "#8b5cf6";
const SPOT_AMBER = "#f59e0b";
const SPOT_GRAD = `linear-gradient(90deg, ${SPOT_PURPLE}, ${SPOT_AMBER})`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function card(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: "var(--card)", border: "1px solid var(--border)",
    borderRadius: 14, padding: "20px 22px", ...extra,
  };
}

function SectionTitle({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, letterSpacing: "1.5px",
      color: accent ?? "var(--muted)",
      textTransform: "uppercase", marginBottom: 16,
      fontFamily: "var(--font-mono, monospace)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      {children}
    </div>
  );
}

function Chip({ label, color = "gray" }: { label: string; color?: string }) {
  const c = BADGE_COLORS[color] ?? BADGE_COLORS.blue;
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 5,
      background: c.bg, color: c.color, letterSpacing: "0.5px", whiteSpace: "nowrap",
      border: `1px solid ${c.color}30`,
    }}>
      {label}
    </span>
  );
}

function Divider() {
  return <div style={{ borderBottom: "1px solid var(--border)", margin: "12px 0" }} />;
}

// ─── Sticky summary bar ─────────────────────────────────────────────────────────
// Pins verdict + price + the CORE key levels while scrolling so the primary
// decision (core holding) is always one glance away.

function StickySummaryBar({ report, verdictColor }: { report: StockReport; verdictColor: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 340);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  const preferred = report.entryStrategy.entryLevels.find((e) => e.preferred) ?? report.entryStrategy.entryLevels[0];
  const sl = report.entryStrategy.stopLoss;
  const isPositive = report.priceChange >= 0;

  const metric = (label: string, value: string, color: string) => (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 8, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color, fontFamily: "var(--font-mono, monospace)", lineHeight: 1.3 }}>{value}</div>
    </div>
  );

  return (
    <div className="sticky-summary" style={{ background: "rgba(8,8,14,0.82)", borderBottom: `1px solid var(--border-bright)` }}>
      <div style={{ height: 2, background: `linear-gradient(90deg, ${verdictColor}, transparent)` }} />
      <div style={{
        maxWidth: 1100, margin: "0 auto", padding: "9px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 18, fontWeight: 900, fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.5px" }}>{report.ticker}</span>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 6,
            background: `${verdictColor}1f`, color: verdictColor, border: `1px solid ${verdictColor}40`,
            fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.5px", whiteSpace: "nowrap",
          }}>
            {report.verdict} · {report.scoreLabel ?? "Core"}
          </span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 900, fontFamily: "var(--font-mono, monospace)" }}>${report.price.toFixed(2)}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: isPositive ? "#10b981" : "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>
              {isPositive ? "▲" : "▼"}{Math.abs(report.priceChange).toFixed(2)}%
            </span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {metric("Buy dip", preferred.rangeMax ? `$${preferred.level}–${preferred.rangeMax}` : `$${preferred.level}`, "#3b82f6")}
          {sl.tight !== undefined && metric("Core stop", `$${sl.tight}`, "#ef4444")}
          {metric("Target", `$${report.entryStrategy.tp2.price}`, "#10b981")}
        </div>
      </div>
    </div>
  );
}

// ─── Verdict (promoted: large, directly under hero) ─────────────────────────────

function VerdictHeadline({ report, verdictColor, lang }: { report: StockReport; verdictColor: string; lang: Lang }) {
  const th = lang === "th";
  const score = report.score;
  return (
    <div style={{
      ...card({
        borderLeft: `4px solid ${verdictColor}`,
        padding: "26px 30px",
        marginBottom: 14,
      }),
      background: `linear-gradient(120deg, ${verdictColor}14 0%, ${verdictColor}05 32%, var(--card) 68%)`,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 50% 120% at 0% 50%, ${verdictColor}10 0%, transparent 60%)`,
      }} />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "2px", color: "var(--muted)", textTransform: "uppercase", marginBottom: 10, fontFamily: "var(--font-mono, monospace)" }}>
            📝 {th ? "คำตัดสินหลัก · Core Holding" : "Primary Verdict · Core Holding"}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{
              fontSize: "clamp(30px, 5vw, 46px)", fontWeight: 900, color: verdictColor,
              fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-1.5px", lineHeight: 0.95,
            }}>
              {report.verdict}
            </span>
            <span style={{
              fontSize: 13, fontWeight: 800, padding: "5px 13px", borderRadius: 8,
              background: `${verdictColor}1c`, color: verdictColor, border: `1px solid ${verdictColor}3a`,
              fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.5px",
            }}>
              {report.scoreLabel ?? "Core Holding"}
            </span>
          </div>
          <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7, margin: 0, fontStyle: "italic", maxWidth: 640 }}>
            {report.entryStrategy.verdict}
          </p>
        </div>
        {score !== undefined && (
          <div style={{ flexShrink: 0, textAlign: "center", paddingTop: 4 }}>
            <div style={{
              fontSize: 52, fontWeight: 900, color: verdictColor, lineHeight: 0.9,
              fontFamily: "var(--font-mono, monospace)", letterSpacing: "-2px",
            }}>
              {score}
            </div>
            <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "var(--font-mono, monospace)", marginTop: 2 }}>
              {th ? "คะแนน / 100" : "score / 100"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CatalystCard({ catalysts }: { catalysts: Catalyst[] }) {
  return (
    <div style={card()}>
      <SectionTitle>⚡ Catalyst</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {catalysts.map((c, i) => {
          const dotColor = DOT_COLORS[c.dotColor ?? "yellow"];
          return (
            <div key={i} style={{ display: "flex", gap: 12 }}>
              <div style={{ flexShrink: 0, marginTop: 5 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", background: dotColor,
                  animation: "pulseDot 2s ease-in-out infinite",
                  boxShadow: `0 0 6px ${dotColor}`,
                  color: dotColor,
                }} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 5 }}>
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: "var(--text)",
                    fontFamily: "var(--font-display, sans-serif)",
                  }}>
                    {c.icon} {c.name}
                  </span>
                  {c.urgencyLabel && <Chip label={c.urgencyLabel} color="red" />}
                </div>
                <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, margin: "0 0 6px" }}>{c.description}</p>
                {c.dateBadge && <Chip label={c.dateBadge} color={c.badgeColor ?? "yellow"} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EntryCard({ levels }: { levels: EntryLevel[] }) {
  return (
    <div style={card()}>
      <SectionTitle>🎯 Entry Point</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {levels.map((e, i) => {
          const priceStr = e.rangeMax ? `$${e.level}–${e.rangeMax}` : `$${e.level.toFixed(2)}`;
          return (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{e.label}</span>
                  {e.preferred && <Chip label="PREFERRED" color="blue" />}
                </div>
                <span style={{
                  fontSize: 18, fontWeight: 800, color: "var(--text)",
                  fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.5px",
                }}>
                  {priceStr}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "#475569" }}>{e.note}</span>
                {e.timing && <span style={{ fontSize: 11, color: "var(--muted)" }}>{e.timing}</span>}
              </div>
              {i < levels.length - 1 && <Divider />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TakeProfitCard({ report }: { report: StockReport }) {
  const tps = [
    { label: "TP1", data: report.entryStrategy.tp1 },
    { label: "TP2", data: report.entryStrategy.tp2 },
    { label: "TP3", data: report.entryStrategy.tp3 },
  ];
  return (
    <div style={card()}>
      <SectionTitle>✅ Take Profit</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {tps.map(({ label, data }, i) => (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}{data.moon ? " 🌙" : ""}</span>
                {data.note && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{data.note}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>
                  ${data.price}
                </div>
                {data.pct !== undefined && (
                  <div style={{ fontSize: 11, color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>+{data.pct}%</div>
                )}
              </div>
            </div>
            {i < tps.length - 1 && <Divider />}
          </div>
        ))}
      </div>
    </div>
  );
}

function StopLossCard({ report }: { report: StockReport }) {
  const sl = report.entryStrategy.stopLoss;
  if (!sl.tight && !sl.hard) {
    return (
      <div style={card()}>
        <SectionTitle>🔴 Stop Loss</SectionTitle>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>
          ${(sl as { value?: number }).value?.toFixed(2)}
        </div>
      </div>
    );
  }
  return (
    <div style={card()}>
      <SectionTitle>🔴 Stop Loss</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {sl.tight !== undefined && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Tight Stop</span>
              {sl.tightNote && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sl.tightNote}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>${sl.tight}</div>
              {sl.tightPct !== undefined && <div style={{ fontSize: 11, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>{sl.tightPct}%</div>}
            </div>
          </div>
        )}
        {sl.tight !== undefined && sl.hard !== undefined && <Divider />}
        {sl.hard !== undefined && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Hard Stop</span>
              {sl.hardNote && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sl.hardNote}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>${sl.hard}</div>
              {sl.hardPct !== undefined && <div style={{ fontSize: 11, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>{sl.hardPct}%</div>}
            </div>
          </div>
        )}
        {sl.riskReward && (
          <>
            <Divider />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Risk / Reward</span>
                {sl.rrNote && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sl.rrNote}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", fontFamily: "var(--font-mono, monospace)" }}>{sl.riskReward}</div>
                {sl.rrWarning && <Chip label={`⚠ ${sl.rrWarning}`} color="yellow" />}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EstimateDateCard({ dates }: { dates: EstimateDate[] }) {
  return (
    <div style={card()}>
      <SectionTitle>📅 Estimate Date</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {dates.map((d, i) => {
          const dateColor = d.highlight === "blue" ? "#3b82f6" : "#f59e0b";
          return (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{d.event}</div>
                  {d.note && <div style={{ fontSize: 11, color: "#475569" }}>{d.note}</div>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: dateColor, fontFamily: "var(--font-mono, monospace)" }}>{d.dateRange}</div>
                  {d.est && <div style={{ fontSize: 11, color: "var(--muted)" }}>{d.est}</div>}
                </div>
              </div>
              {i < dates.length - 1 && <Divider />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Scenarios — focal diverging chart (full width, the visual anchor) ──────────

function ScenariosCard({ scenarios, lang }: { scenarios: Scenario[]; lang: Lang }) {
  const th = lang === "th";
  const maxUp = Math.max(0, ...scenarios.map((s) => s.pct));
  const maxDown = Math.max(0, ...scenarios.map((s) => -s.pct));
  const total = (maxUp + maxDown) || 1;
  // single constant scale so up/down bar lengths are directly comparable
  const zero = (maxDown / total) * 100;

  return (
    <div style={{ ...card({ padding: "22px 26px" }), marginBottom: 12 }}>
      <SectionTitle>📈 Possible Up % — {th ? "ฉากทัศน์ราคา" : "Scenario Spread"}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {scenarios.map((s, i) => {
          const c = SCENARIO_COLORS[s.color] ?? SCENARIO_COLORS.green;
          const isUp = s.pct >= 0;
          const wPct = (Math.abs(s.pct) / total) * 100;
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "48px minmax(0, 1fr) 52px 50px", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.text, fontFamily: "var(--font-mono, monospace)" }}>
                {s.label}
              </div>
              {/* track — overflow hidden guarantees bars never escape the card */}
              <div style={{ position: "relative", height: 22, borderRadius: 6, background: "#12121f", overflow: "hidden" }}>
                {/* zero baseline */}
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `${zero}%`, width: 1, background: "var(--border-bright)", zIndex: 2 }} />
                {/* fill */}
                <div style={{
                  position: "absolute", top: 0, bottom: 0,
                  ...(isUp ? { left: `${zero}%` } : { right: `${100 - zero}%` }),
                  width: `${wPct}%`,
                  background: isUp
                    ? `linear-gradient(90deg, ${c.bar}66, ${c.bar})`
                    : `linear-gradient(270deg, ${c.bar}66, ${c.bar})`,
                  borderRadius: 4,
                  animation: `barFill 0.9s cubic-bezier(0.22,1,0.36,1) ${i * 0.08}s both`,
                }} />
              </div>
              <div style={{ textAlign: "right", fontSize: 15, fontWeight: 800, color: c.text, fontFamily: "var(--font-mono, monospace)" }}>
                {s.pct < 0 ? "" : "+"}{s.pct}%
              </div>
              <div style={{ textAlign: "right", fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                ${s.price}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingLeft: 60, paddingRight: 114, fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", letterSpacing: "1px", textTransform: "uppercase" }}>
        <span>← {th ? "ขาลง" : "downside"}</span>
        <span>{th ? "ขาขึ้น" : "upside"} →</span>
      </div>
    </div>
  );
}

// ─── Analyst Targets — horizontal bar comparison ───────────────────────────────

function AnalystTargetsBar({ report, lang }: { report: StockReport; lang: Lang }) {
  const th = lang === "th";
  const targets = report.analystTargets ?? [];
  const price = report.price;
  const maxT = Math.max(price, ...targets.map((t) => t.target)) * 1.04;

  return (
    <div style={{ ...card(), marginBottom: 12 }}>
      <SectionTitle>🎯 Analyst Targets</SectionTitle>
      <p style={{ fontSize: 11, color: "var(--muted)", margin: "-8px 0 18px", fontFamily: "var(--font-mono, monospace)", lineHeight: 1.6 }}>
        {th
          ? "ราคาเป้าหมายนักวิเคราะห์ Wall Street — เทียบกับราคาปัจจุบันเพื่อ cross-check TP"
          : "Wall Street price targets vs the current price — cross-check our TP levels"}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        {targets.map((a, i) => {
          const wPct = (a.target / maxT) * 100;
          const upside = ((a.target - price) / price) * 100;
          return (
            <div key={i} className="hover-lift" style={{ borderRadius: 8, padding: "4px 6px", margin: "0 -6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 600 }}>{a.firm}</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{a.rating}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>${a.target}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: upside >= 0 ? "#10b981" : "#ef4444", fontFamily: "var(--font-mono, monospace)", width: 48, textAlign: "right" }}>
                    {upside >= 0 ? "+" : ""}{upside.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div style={{ position: "relative", height: 9, background: "#12121f", borderRadius: 5, overflow: "hidden" }}>
                <div className="analyst-fill" style={{
                  position: "absolute", left: 0, top: 0, bottom: 0, width: `${wPct}%`,
                  background: "linear-gradient(90deg, #10b98155, #10b981)", borderRadius: 5,
                }} />
                {/* current price marker */}
                <div style={{ position: "absolute", left: `${(price / maxT) * 100}%`, top: -2, bottom: -2, width: 2, background: "#e2e8f0" }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
        <div style={{ width: 12, height: 2, background: "#e2e8f0" }} />
        <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
          {th ? `ราคาปัจจุบัน $${price.toFixed(2)}` : `current price $${price.toFixed(2)}`}
        </span>
      </div>
    </div>
  );
}

// ─── Catalyst Spot Mode — tactical overlay (purple+amber, clearly subordinate) ──

function EarningsHistoryStrip({ cs, lang }: { cs: CatalystSpot; lang: Lang }) {
  const th = lang === "th";
  const hist = cs.earningsHistory ?? [];
  if (hist.length === 0) return null;
  const maxAbs = Math.max(...hist.map((h) => Math.abs(h.reactionPct))) || 1;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "var(--font-mono, monospace)" }}>
          📊 {th ? `ประวัติตอบรับ ${hist.length} ไตรมาส` : `${hist.length}-quarter reaction history`}
        </span>
        <span style={{ fontSize: 10, color: "#64748b", fontFamily: "var(--font-mono, monospace)" }}>
          {th ? "day-1 move" : "day-1 move"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {hist.map((h, i) => {
          const up = h.reactionPct >= 0;
          const col = up ? "#10b981" : "#ef4444";
          const w = (Math.abs(h.reactionPct) / maxAbs) * 100;
          return (
            <div key={i} className="hover-lift" style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 7, padding: "5px 7px", margin: "0 -7px" }}>
              <div style={{ width: 64, flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono, monospace)" }}>{h.quarter}</div>
                <div style={{ fontSize: 9, color: "#64748b", fontFamily: "var(--font-mono, monospace)" }}>{h.date}</div>
              </div>
              <div style={{ flex: 1, position: "relative", height: 16 }}>
                <div style={{ position: "absolute", inset: 0, background: "#12121f", borderRadius: 5 }} />
                <div style={{
                  position: "absolute", top: 0, bottom: 0, left: 0, width: `${w}%`,
                  background: `linear-gradient(90deg, ${col}55, ${col})`, borderRadius: 5,
                }} />
                {h.note && (
                  <span style={{ position: "absolute", left: 9, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 9.5, color: "#cbd5e1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "94%" }}>
                    {h.note}
                  </span>
                )}
              </div>
              <div style={{ width: 46, textAlign: "right", flexShrink: 0, fontSize: 13, fontWeight: 800, color: col, fontFamily: "var(--font-mono, monospace)" }}>
                {up ? "+" : ""}{h.reactionPct}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SizingBreakdown({ cs, lang }: { cs: CatalystSpot; lang: Lang }) {
  const th = lang === "th";
  const steps = cs.spotSizing.breakdown ?? [];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontSize: 38, fontWeight: 900, color: SPOT_PURPLE, fontFamily: "var(--font-mono, monospace)", lineHeight: 1 }}>{cs.spotSizing.pct}%</div>
        <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", marginTop: 3 }}>
          {th ? "ของพอร์ต" : "of portfolio"}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        {steps.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {steps.map((s, i) => {
              const isTotal = s.total;
              const isAdd = s.value.startsWith("+");
              const isSub = s.value.startsWith("−") || s.value.startsWith("-");
              const valColor = isTotal ? SPOT_PURPLE : isAdd ? "#10b981" : isSub ? "#ef4444" : "var(--muted)";
              return (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                  paddingTop: isTotal ? 7 : 0,
                  borderTop: isTotal ? "1px dashed var(--border-bright)" : "none",
                }}>
                  <span style={{ fontSize: 11, color: isTotal ? "var(--text)" : "#94a3b8", fontWeight: isTotal ? 700 : 400, lineHeight: 1.4 }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: isTotal ? 14 : 12, fontWeight: 800, color: valColor, fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap" }}>
                    {s.value}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.65, margin: 0 }}>{cs.spotSizing.reason}</p>
        )}
        {steps.length > 0 && (
          <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, margin: "10px 0 0", fontStyle: "italic" }}>{cs.spotSizing.reason}</p>
        )}
      </div>
    </div>
  );
}

function CatalystSpotCard({ cs, lang, coreTightPct, coreHardPct }: { cs: CatalystSpot; lang: Lang; coreTightPct?: number; coreHardPct?: number }) {
  const th = lang === "th";
  const spotStops = `${cs.stopPreCatalyst.pct}% / ${cs.stopPostCatalyst.pct}%`;
  const coreStops = [coreTightPct, coreHardPct].filter((v) => v !== undefined).map((v) => `${v}%`).join(" / ") || (th ? "ชุด core ด้านบน" : "the core set above");

  const blockLabel = (icon: string, label: string, sublabel?: string) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono, monospace)" }}>
        <span>{icon}</span>
        <span style={{ textTransform: "uppercase", letterSpacing: "0.5px", color: SPOT_PURPLE }}>{label}</span>
      </div>
      {sublabel && (
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 3, fontFamily: "var(--font-mono, monospace)", paddingLeft: 18 }}>{sublabel}</div>
      )}
    </div>
  );

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Heavy divider that hard-separates the tactical overlay from the core report */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "26px 0 16px" }}>
        <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg, transparent, ${SPOT_PURPLE}55)` }} />
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase",
          fontFamily: "var(--font-mono, monospace)",
          padding: "5px 14px", borderRadius: 20,
          background: `${SPOT_PURPLE}14`, border: `1px solid ${SPOT_PURPLE}40`,
          color: "#c4b5fd", whiteSpace: "nowrap",
        }}>
          ⚡ {th ? "ชั้นเสริม · Tactical Overlay" : "Optional Layer · Tactical Overlay"}
        </span>
        <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg, ${SPOT_AMBER}55, transparent)` }} />
      </div>

      <div style={{ borderRadius: 15, padding: 1.5, background: SPOT_GRAD, animation: "spotPulse 5s ease-in-out infinite" }}>
      <div className="scanlines" style={{
        borderRadius: 13.5, padding: "22px 24px",
        background: `linear-gradient(160deg, #100c1c 0%, var(--card) 42%, #15110a 100%)`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 900, fontFamily: "var(--font-display, sans-serif)", background: SPOT_GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            🎯 Catalyst Spot Mode
          </span>
        </div>
        <p style={{ fontSize: 11.5, color: "#cbd5e1", margin: "0 0 14px", fontFamily: "var(--font-mono, monospace)", lineHeight: 1.6 }}>
          {th
            ? "โหมดเล่นรอบ catalyst (earnings Sep 2026) ระยะสั้นเท่านั้น — เป็น overlay เสริม ไม่ใช่คำตัดสินคู่ขนานกับ Core Holding"
            : "Short-term play around the catalyst (Sep 2026 earnings) only — an optional overlay, not a verdict that ranks equal to the Core Holding."}
        </p>

        {/* Stop-loss scope warning — the key anti-confusion callout */}
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          background: `${SPOT_AMBER}12`, border: `1px solid ${SPOT_AMBER}40`, borderRadius: 10,
          padding: "11px 14px", marginBottom: 20,
        }}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
          <p style={{ fontSize: 11.5, color: "#fcd9a0", margin: 0, lineHeight: 1.6 }}>
            {th
              ? <>ใช้ stop loss ชุดนี้ (<b style={{ color: "#fbbf24" }}>{spotStops}</b>) เฉพาะตอนเล่น spot รอบ earnings เท่านั้น — <b>ไม่ใช่</b> stop loss ของ core holding (ชุด <b style={{ color: "#10b981" }}>{coreStops}</b> ด้านบน). ถ้าถือยาว ให้ยึดชุด core</>
              : <>Use this stop-loss set (<b style={{ color: "#fbbf24" }}>{spotStops}</b>) only when trading the earnings spot — <b>not</b> for the core holding (use the <b style={{ color: "#10b981" }}>{coreStops}</b> set above). If you are holding long-term, follow the core set.</>}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Pre-runup */}
          <div>
            {blockLabel("📈", "Pre-Catalyst Run-up Pattern")}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: "#10b98118", color: "#10b981", border: "1px solid #10b98130", fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>{cs.preRunupPct}</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f630", fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>{cs.preRunupTiming}</span>
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.65, margin: 0 }}>{cs.preRunup}</p>
          </div>

          <Divider />

          {/* Earnings history (NEW) */}
          <EarningsHistoryStrip cs={cs} lang={lang} />

          <Divider />

          {/* Post-catalyst win/lose */}
          <div>
            {blockLabel("🎲", th ? "สรุปสถิติ Post-Catalyst" : "Historical Post-Catalyst Move")}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: "#10b98110", border: "1px solid #10b98130", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>{th ? "✅ Catalyst ออกดี" : "✅ Catalyst Win"}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>avg +{cs.postWin.avgPct}%</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#64748b", fontFamily: "var(--font-mono, monospace)" }}>range: {cs.postWin.range}</span>
                  {cs.postWin.exampleDate && <span style={{ fontSize: 10, color: "#475569", fontFamily: "var(--font-mono, monospace)" }}>· {cs.postWin.exampleDate}</span>}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.55 }}>{cs.postWin.note}</div>
              </div>
              <div style={{ background: "#ef444410", border: "1px solid #ef444430", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>{th ? "❌ Catalyst ล้มเหลว" : "❌ Catalyst Miss"}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>avg {cs.postLose.avgPct}%</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#64748b", fontFamily: "var(--font-mono, monospace)" }}>range: {cs.postLose.range}</span>
                  {cs.postLose.exampleDate && <span style={{ fontSize: 10, color: "#475569", fontFamily: "var(--font-mono, monospace)" }}>· {cs.postLose.exampleDate}</span>}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.55 }}>{cs.postLose.note}</div>
              </div>
            </div>
          </div>

          <Divider />

          {/* Sizing breakdown (NEW) */}
          <div>
            {blockLabel("💼", "Spot Position Sizing", th ? "ที่มาของตัวเลข % ที่แนะนำ" : "How the recommended % is derived")}
            <SizingBreakdown cs={cs} lang={lang} />
          </div>

          <Divider />

          {/* Spot stop loss */}
          <div>
            {blockLabel("🛑", th ? "Stop Loss แบบ Spot" : "Stop Loss · Spot Trade", th ? "จุดตัดขาดทุนของ spot — แยกจาก core holding" : "Spot cut-loss levels — separate from the core holding")}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: "#f59e0b10", border: "1px solid #f59e0b30", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", fontFamily: "var(--font-mono, monospace)" }}>{th ? "ก่อน Catalyst" : "Before Catalyst"}</span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#f59e0b", fontFamily: "var(--font-mono, monospace)" }}>{cs.stopPreCatalyst.pct}%</span>
                    {cs.stopPreCatalyst.price && <span style={{ fontSize: 11, color: "#f59e0b", fontFamily: "var(--font-mono, monospace)", marginLeft: 6 }}>(${cs.stopPreCatalyst.price})</span>}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{cs.stopPreCatalyst.note}</div>
              </div>
              <div style={{ background: "#ef444410", border: "1px solid #ef444430", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>{th ? "หลัง Catalyst (ผล Bad)" : "After Catalyst (Bad Result)"}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>{cs.stopPostCatalyst.pct}%</span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{cs.stopPostCatalyst.note}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Comparable Cases ─────────────────────────────────────────────────────────

function ComparableCasesCard({ cases, lang }: { cases: ComparableCase[]; lang: Lang }) {
  const th = lang === "th";
  const OUTCOME_STYLE: Record<string, { bg: string; color: string; label: string }> = {
    good:  { bg: "#10b98118", color: "#10b981", label: th ? "✅ ดี"      : "✅ Good"  },
    mixed: { bg: "#f59e0b18", color: "#f59e0b", label: th ? "⚡ ปนกัน"  : "⚡ Mixed" },
    bad:   { bg: "#ef444418", color: "#ef4444", label: th ? "❌ แย่"     : "❌ Bad"   },
  };

  return (
    <div style={{ ...card(), marginBottom: 12 }}>
      <SectionTitle>🔍 Similar-Catalyst Comparable Check</SectionTitle>
      <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 14px", fontFamily: "var(--font-mono, monospace)" }}>
        {th
          ? "หุ้นอื่นที่เคยผ่าน catalyst แบบเดียวกัน — ใช้ calibrate ว่า target +30%+ realistic แค่ไหน"
          : "Stocks that went through similar catalyst events — calibrate whether the +30%+ target is realistic"}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cases.map((c, i) => {
          const s = OUTCOME_STYLE[c.outcome] ?? OUTCOME_STYLE.mixed;
          const moveColor = c.movePct >= 0 ? "#10b981" : "#ef4444";
          return (
            <div key={i} className="hover-lift" style={{
              background: "#ffffff05", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px",
              borderLeft: `3px solid ${s.color}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>{c.ticker}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 4, background: s.bg, color: s.color, border: `1px solid ${s.color}30`, fontFamily: "var(--font-mono, monospace)" }}>{s.label}</span>
                  <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{c.date}</span>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: moveColor, fontFamily: "var(--font-mono, monospace)" }}>
                    {c.movePct >= 0 ? "+" : ""}{c.movePct}%
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                    {th ? `ใน ${c.days} วัน` : `in ${c.days} day${c.days !== 1 ? "s" : ""}`}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontFamily: "var(--font-mono, monospace)" }}>{c.event}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.55 }}>{c.note}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Macro ────────────────────────────────────────────────────────────────────

function MacroCard({ report, lang }: { report: StockReport; lang: Lang }) {
  const fedColor = RISK_COLOR[report.macroRisk.fedRisk] ?? "#64748b";
  return (
    <div style={{ ...card(), marginBottom: 12 }}>
      <SectionTitle>
        🏛️ Fed / Macro Risk —{" "}
        <span style={{ color: fedColor, fontFamily: "var(--font-mono, monospace)" }}>{report.macroRisk.fedRisk}</span>
      </SectionTitle>
      <p style={{ fontSize: 11, color: "var(--muted)", margin: "-8px 0 16px", fontFamily: "var(--font-mono, monospace)", lineHeight: 1.6 }}>
        {lang === "th"
          ? "ประเมินว่าสภาพแวดล้อม Fed / อัตราดอกเบี้ย / เงินเฟ้อ กระทบหุ้นนี้มากแค่ไหน — LOW = เสี่ยงน้อย, HIGH = ระวัง"
          : "Assesses how Fed policy / interest rates / inflation affect this stock — LOW = minimal risk, HIGH = proceed with caution"}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {([
          ["Rate Outlook", report.macroRisk.rateOutlook],
          ["Inflation", report.macroRisk.inflationNote],
          ["Sector Impact", report.macroRisk.sectorImpact],
          ["Summary", report.macroRisk.summary],
        ] as [string, string][]).map(([label, val]) => (
          <div key={label} style={{ background: "#ffffff07", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 9, color: "var(--muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)" }}>{label}</div>
            <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.55 }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Language Toggle ──────────────────────────────────────────────────────────

function LangToggle({ lang, hasThai, onChange }: { lang: Lang; hasThai: boolean; onChange: (l: Lang) => void }) {
  if (!hasThai) return null;
  return (
    <div style={{ display: "flex", gap: 4, background: "#1a1a2e", borderRadius: 8, padding: 3 }}>
      {(["en", "th"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          style={{
            fontSize: 11, fontWeight: 800, padding: "4px 14px", borderRadius: 6, border: "none", cursor: "pointer",
            background: lang === l ? "#3b82f6" : "transparent",
            color: lang === l ? "#fff" : "var(--muted)",
            transition: "background 0.15s, color 0.15s",
            textTransform: "uppercase", letterSpacing: "1px",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function ReportContent({ report: baseReport }: { report: StockReport }) {
  const [lang, setLang] = useState<Lang>("en");
  const report = applyTranslation(baseReport, lang);
  const hasThai = !!baseReport.i18n?.th;

  const verdictColor = VERDICT_COLORS[report.verdict] ?? "#64748b";
  const isPositive = report.priceChange >= 0;

  return (
    <div className="terminal-surface" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <StickySummaryBar report={report} verdictColor={verdictColor} />

      {/* Nav row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
          ← All Reports
        </Link>
        <LangToggle lang={lang} hasThai={hasThai} onChange={setLang} />
      </div>

      {/* Language-keyed wrapper → smooth fade on EN/TH swap */}
      <div key={lang} className="lang-fade">
        {/* Hero card */}
        <div style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderTop: `2px solid ${verdictColor}`,
          borderRadius: 16,
          padding: "24px 26px",
          marginBottom: 14,
          position: "relative",
          overflow: "hidden",
          animation: "fadeInUp 0.4s ease both",
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            background: `radial-gradient(ellipse 60% 50% at 20% 0%, ${verdictColor}14 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 90% 100%, ${verdictColor}0a 0%, transparent 70%)`,
            pointerEvents: "none",
          }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, position: "relative", marginBottom: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                <h1 style={{
                  fontSize: "clamp(24px, 5vw, 44px)", fontWeight: 900, margin: 0, letterSpacing: "-1px",
                  fontFamily: "var(--font-display, sans-serif)", lineHeight: 1,
                }}>
                  {report.ticker}
                </h1>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 8,
                  background: `${verdictColor}20`, color: verdictColor,
                  border: `1px solid ${verdictColor}40`, whiteSpace: "nowrap",
                  fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.5px",
                }}>
                  {report.scoreLabel ?? report.verdict}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", lineHeight: 1.4 }}>
                {report.companyName}{report.exchange ? ` · ${report.exchange}` : ""}{report.sector ? ` · ${report.sector}` : ""}
              </div>
            </div>

            <div style={{ flexShrink: 0, textAlign: "right" }}>
              <div style={{ fontSize: "clamp(20px, 4vw, 34px)", fontWeight: 900, letterSpacing: "-1px", fontFamily: "var(--font-mono, monospace)", lineHeight: 1 }}>
                ${report.price.toFixed(2)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 3, color: isPositive ? "#10b981" : "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>
                {isPositive ? "▲" : "▼"} {Math.abs(report.priceChange).toFixed(2)}%
              </div>
              {report.marketCap && (
                <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginTop: 2 }}>MCap {report.marketCap}</div>
              )}
              {report.priceNote && (
                <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{report.priceNote}</div>
              )}
            </div>
          </div>

          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.75, margin: 0, position: "relative" }}>{report.summary}</p>
        </div>

        {/* Verdict — promoted directly under hero, large & prominent */}
        <VerdictHeadline report={report} verdictColor={verdictColor} lang={lang} />

        {/* Row 1 — Catalyst · Entry · Take Profit (original responsive grid) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 12 }}>
          <CatalystCard catalysts={report.catalysts} />
          <EntryCard levels={report.entryStrategy.entryLevels} />
          <TakeProfitCard report={report} />
        </div>

        {/* Row 2 — Stop Loss · Estimate Date (original responsive grid) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 12 }}>
          <StopLossCard report={report} />
          {report.estimateDates && report.estimateDates.length > 0 ? (
            <EstimateDateCard dates={report.estimateDates} />
          ) : (
            <div style={card()}>
              <SectionTitle>📅 Estimate Date</SectionTitle>
              {(report as { earningsDate?: string }).earningsDate && (
                <div style={{ fontSize: 14, color: "#f59e0b", fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>
                  Earnings: {(report as { earningsDate?: string }).earningsDate}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Possible Up % — kept as the new full-width diverging chart */}
        {report.scenarios && report.scenarios.length > 0 && (
          <ScenariosCard scenarios={report.scenarios} lang={lang} />
        )}

        {/* Macro */}
        <MacroCard report={report} lang={lang} />

        {/* Analyst targets — horizontal bars */}
        {report.analystTargets && report.analystTargets.length > 0 && (
          <AnalystTargetsBar report={report} lang={lang} />
        )}

        {/* Comparable cases */}
        {report.comparableCases && report.comparableCases.length > 0 && (
          <ComparableCasesCard cases={report.comparableCases} lang={lang} />
        )}

        {/* ── Tactical overlay — clearly subordinate, purple+amber ── */}
        {report.catalystSpot && (
          <CatalystSpotCard
            cs={report.catalystSpot}
            lang={lang}
            coreTightPct={report.entryStrategy.stopLoss.tightPct}
            coreHardPct={report.entryStrategy.stopLoss.hardPct}
          />
        )}

        {/* Sources */}
        <div style={card()}>
          <SectionTitle>📎 Sources</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {report.sources.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: "#3b82f6", wordBreak: "break-all", fontFamily: "var(--font-mono, monospace)" }}>
                {src}
              </a>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#475569", marginTop: 12, marginBottom: 0 }}>
            Generated {report.generatedAt.slice(0, 10)} · Not financial advice
          </p>
        </div>
      </div>
    </div>
  );
}
