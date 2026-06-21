"use client";

import { useState } from "react";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function card(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: "var(--card)", border: "1px solid var(--border)",
    borderRadius: 14, padding: "20px 22px", ...extra,
  };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "var(--muted)",
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

function ScenariosCard({ scenarios }: { scenarios: Scenario[] }) {
  const maxPct = Math.max(...scenarios.map((s) => Math.abs(s.pct)));
  return (
    <div style={card()}>
      <SectionTitle>📈 Possible Up %</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {scenarios.map((s, i) => {
          const c = SCENARIO_COLORS[s.color] ?? SCENARIO_COLORS.green;
          const widthPct = (Math.abs(s.pct) / maxPct) * 100;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 44, fontSize: 11, color: "var(--muted)", flexShrink: 0, fontFamily: "var(--font-mono, monospace)" }}>
                {s.label}
              </div>
              <div style={{ flex: 1, background: "#1a1a2e", borderRadius: 6, height: 8, overflow: "hidden", position: "relative" }}>
                <div style={{
                  width: `${widthPct}%`, height: "100%",
                  background: `linear-gradient(90deg, ${c.bar}99, ${c.bar})`,
                  borderRadius: 6,
                  animation: `barFill 0.8s ease ${i * 0.1}s both`,
                }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: c.text, width: 54, textAlign: "right", fontFamily: "var(--font-mono, monospace)" }}>
                {s.pct < 0 ? "" : "+"}{s.pct}%
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", width: 42, textAlign: "right", fontFamily: "var(--font-mono, monospace)" }}>
                ${s.price}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Catalyst Spot Mode ───────────────────────────────────────────────────────

function CatalystSpotCard({ cs, currentPrice, lang }: { cs: CatalystSpot; currentPrice: number; lang: Lang }) {
  const th = lang === "th";
  const blocks: { icon: string; label: string; sublabel?: string; content: React.ReactNode }[] = [
    {
      icon: "📈",
      label: "Pre-Catalyst Run-up Pattern",
      content: (
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: "#10b98118", color: "#10b981", border: "1px solid #10b98130", fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>
              {cs.preRunupPct}
            </span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f630", fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>
              {cs.preRunupTiming}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.65, margin: 0 }}>{cs.preRunup}</p>
        </div>
      ),
    },
    {
      icon: "🎲",
      label: "Historical Post-Catalyst Move",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: "#10b98110", border: "1px solid #10b98130", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>
                {th ? "✅ Catalyst ออกดี" : "✅ Catalyst Win"}
              </span>
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
              <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>
                {th ? "❌ Catalyst ล้มเหลว" : "❌ Catalyst Miss"}
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>avg {cs.postLose.avgPct}%</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#64748b", fontFamily: "var(--font-mono, monospace)" }}>range: {cs.postLose.range}</span>
              {cs.postLose.exampleDate && <span style={{ fontSize: 10, color: "#475569", fontFamily: "var(--font-mono, monospace)" }}>· {cs.postLose.exampleDate}</span>}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.55 }}>{cs.postLose.note}</div>
          </div>
        </div>
      ),
    },
    {
      icon: "💼",
      label: "Spot Position Sizing",
      sublabel: th
        ? "แนะนำให้ใส่เงินกี่ % ของพอร์ตสำหรับ position นี้โดยเฉพาะ"
        : "Recommended % of portfolio to allocate for this position",
      content: (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#8b5cf6", fontFamily: "var(--font-mono, monospace)", lineHeight: 1 }}>{cs.spotSizing.pct}%</div>
            <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", marginTop: 2 }}>
              {th ? "ของพอร์ต" : "of portfolio"}
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.65, margin: 0 }}>{cs.spotSizing.reason}</p>
        </div>
      ),
    },
    {
      icon: "🛑",
      label: th ? "Stop Loss แบบ Spot" : "Stop Loss · Spot Trade",
      sublabel: th
        ? "จุดตัดขาดทุนสำหรับ spot trade — แยกจาก stop loss ของ core holding"
        : "Cut-loss levels for spot trade — separate from core holding stop loss",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: "#f59e0b10", border: "1px solid #f59e0b30", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", fontFamily: "var(--font-mono, monospace)" }}>
                {th ? "ก่อน Catalyst" : "Before Catalyst"}
              </span>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#f59e0b", fontFamily: "var(--font-mono, monospace)" }}>{cs.stopPreCatalyst.pct}%</span>
                {cs.stopPreCatalyst.price && (
                  <span style={{ fontSize: 11, color: "#f59e0b", fontFamily: "var(--font-mono, monospace)", marginLeft: 6 }}>(${cs.stopPreCatalyst.price})</span>
                )}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{cs.stopPreCatalyst.note}</div>
          </div>
          <div style={{ background: "#ef444410", border: "1px solid #ef444430", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>
                {th ? "หลัง Catalyst (ผล Bad)" : "After Catalyst (Bad Result)"}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>{cs.stopPostCatalyst.pct}%</span>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{cs.stopPostCatalyst.note}</div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div style={{ ...card(), marginBottom: 12 }}>
      <SectionTitle>🎯 Catalyst Spot Mode</SectionTitle>
      <p style={{ fontSize: 11, color: "var(--muted)", margin: "-8px 0 16px", fontFamily: "var(--font-mono, monospace)", lineHeight: 1.6 }}>
        {th
          ? "การวิเคราะห์สำหรับเปิด position ระยะสั้นเพื่อเล่น catalyst event โดยเฉพาะ — แยกจาก core holding"
          : "Short-term position analysis for catalyst event plays — separate from your core holding"}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {blocks.map(({ icon, label, sublabel, content }, i) => (
          <div key={i}>
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "var(--text)",
                display: "flex", alignItems: "center", gap: 6,
                fontFamily: "var(--font-mono, monospace)",
              }}>
                <span>{icon}</span>
                <span style={{ textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>{label}</span>
              </div>
              {sublabel && (
                <div style={{ fontSize: 10, color: "#475569", marginTop: 3, fontFamily: "var(--font-mono, monospace)", paddingLeft: 18 }}>
                  {sublabel}
                </div>
              )}
            </div>
            {content}
            {i < blocks.length - 1 && <Divider />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Comparable Cases ─────────────────────────────────────────────────────────

function ComparableCasesCard({ cases, currentTicker, lang }: { cases: ComparableCase[]; currentTicker: string; lang: Lang }) {
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
            <div key={i} style={{
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
            textTransform: "uppercase",
            letterSpacing: "1px",
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
  const fedColor = RISK_COLOR[report.macroRisk.fedRisk] ?? "#64748b";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Nav row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
          ← All Reports
        </Link>
        <LangToggle lang={lang} hasThai={hasThai} onChange={setLang} />
      </div>

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
        {/* Gradient mesh background */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: `radial-gradient(ellipse 60% 50% at 20% 0%, ${verdictColor}12 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 90% 100%, ${verdictColor}08 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        {/* Row 1: ticker + price — always on the same line */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, position: "relative", marginBottom: 10 }}>
          {/* Left: ticker + badge + company */}
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

          {/* Right: price — stays pinned to top-right */}
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <div style={{
              fontSize: "clamp(20px, 4vw, 34px)", fontWeight: 900, letterSpacing: "-1px",
              fontFamily: "var(--font-mono, monospace)", lineHeight: 1,
            }}>
              ${report.price.toFixed(2)}
            </div>
            <div style={{
              fontSize: 12, fontWeight: 700, marginTop: 3,
              color: isPositive ? "#10b981" : "#ef4444",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              {isPositive ? "▲" : "▼"} {Math.abs(report.priceChange).toFixed(2)}%
            </div>
            {report.marketCap && (
              <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginTop: 2 }}>
                MCap {report.marketCap}
              </div>
            )}
            {report.priceNote && (
              <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{report.priceNote}</div>
            )}
          </div>
        </div>

        {/* Row 2: summary — full width */}
        <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.75, margin: 0, position: "relative" }}>{report.summary}</p>
      </div>

      {/* Row 1: Catalyst · Entry · TP */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 12 }}>
        <CatalystCard catalysts={report.catalysts} />
        <EntryCard levels={report.entryStrategy.entryLevels} />
        <TakeProfitCard report={report} />
      </div>

      {/* Row 2: Stop Loss · Estimate Date · Scenarios — directly below Row 1 */}
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
        {report.scenarios && report.scenarios.length > 0 ? (
          <ScenariosCard scenarios={report.scenarios} />
        ) : (
          <div style={card()}>
            <SectionTitle>📈 Possible Up %</SectionTitle>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>No scenarios data</div>
          </div>
        )}
      </div>

      {/* Catalyst Spot Mode — shown if catalystSpot data present */}
      {report.catalystSpot && (
        <CatalystSpotCard cs={report.catalystSpot} currentPrice={report.price} lang={lang} />
      )}

      {/* Macro */}
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
            <div key={label} style={{
              background: "#ffffff07", borderRadius: 10, padding: "12px 14px",
              border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: 9, color: "var(--muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)" }}>
                {label}
              </div>
              <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.55 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Analyst Targets */}
      {report.analystTargets && report.analystTargets.length > 0 && (
        <div style={{ ...card(), marginBottom: 12 }}>
          <SectionTitle>🎯 Analyst Targets</SectionTitle>
          <p style={{ fontSize: 11, color: "var(--muted)", margin: "-8px 0 16px", fontFamily: "var(--font-mono, monospace)", lineHeight: 1.6 }}>
            {lang === "th"
              ? "ราคาเป้าหมายจากนักวิเคราะห์ Wall Street — ใช้ cross-check ว่า TP ที่ตั้งไว้สมเหตุสมผลแค่ไหน"
              : "Price targets from Wall Street analysts — cross-check whether our TP levels are reasonable"}
          </p>
          {report.analystTargets.map((a, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0",
              borderBottom: i < report.analystTargets!.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              <span style={{ fontSize: 13, color: "var(--text)" }}>{a.firm}</span>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{a.rating}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>
                  ${a.target}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comparable Cases — shown if data present */}
      {report.comparableCases && report.comparableCases.length > 0 && (
        <ComparableCasesCard cases={report.comparableCases} currentTicker={report.ticker} lang={lang} />
      )}

      {/* Verdict */}
      <div style={{
        ...card({ borderLeft: `3px solid ${verdictColor}`, marginBottom: 12 }),
        background: `linear-gradient(135deg, ${verdictColor}08 0%, var(--card) 50%)`,
      }}>
        <SectionTitle>📝 Verdict</SectionTitle>
        <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.75, margin: 0, fontStyle: "italic" }}>
          {report.entryStrategy.verdict}
        </p>
      </div>

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
  );
}
