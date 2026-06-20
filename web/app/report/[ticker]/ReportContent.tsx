"use client";

import { useState } from "react";
import Link from "next/link";
import { StockReport, Catalyst, EntryLevel, Scenario, EstimateDate } from "@/lib/types";
import { applyTranslation, Lang } from "@/lib/i18n";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  red:    { bg: "#ef444425", color: "#ef4444" },
  yellow: { bg: "#f59e0b25", color: "#f59e0b" },
  green:  { bg: "#10b98125", color: "#10b981" },
  blue:   { bg: "#3b82f625", color: "#3b82f6" },
};

const SCENARIO_COLORS: Record<string, { bar: string; text: string }> = {
  red:    { bar: "#ef4444", text: "#ef4444" },
  yellow: { bar: "#f59e0b", text: "#f59e0b" },
  green:  { bar: "#10b981", text: "#10b981" },
  purple: { bar: "#8b5cf6", text: "#c4b5fd" },
};

function card(extra?: React.CSSProperties): React.CSSProperties {
  return { background: "#111118", border: "1px solid #1e1e2e", borderRadius: 12, padding: "20px 22px", ...extra };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", color: "#64748b", textTransform: "uppercase", marginBottom: 16 }}>
      {children}
    </div>
  );
}

function Chip({ label, color = "gray" }: { label: string; color?: string }) {
  const c = BADGE_COLORS[color] ?? BADGE_COLORS.blue;
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 4, background: c.bg, color: c.color, letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
      {label}
    </span>
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
              <div style={{ flexShrink: 0, marginTop: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, boxShadow: `0 0 6px ${dotColor}` }} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{c.icon} {c.name}</span>
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
                  <span style={{ fontSize: 12, color: "#64748b" }}>{e.label}</span>
                  {e.preferred && <Chip label="PREFERRED" color="blue" />}
                </div>
                <span style={{ fontSize: 17, fontWeight: 800, color: "#e2e8f0" }}>{priceStr}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "#475569" }}>{e.note}</span>
                {e.timing && <span style={{ fontSize: 11, color: "#64748b" }}>{e.timing}</span>}
              </div>
              {i < levels.length - 1 && <div style={{ borderBottom: "1px solid #1e1e2e", marginTop: 10 }} />}
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
                <span style={{ fontSize: 12, color: "#64748b" }}>{label}{data.moon ? " 🌙" : ""}</span>
                {data.note && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{data.note}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#10b981" }}>${data.price}</div>
                {data.pct !== undefined && <div style={{ fontSize: 11, color: "#10b981" }}>+{data.pct}%</div>}
              </div>
            </div>
            {i < tps.length - 1 && <div style={{ borderBottom: "1px solid #1e1e2e", marginTop: 10 }} />}
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
        <div style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}>${sl.value?.toFixed(2)}</div>
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
              <span style={{ fontSize: 12, color: "#64748b" }}>Tight Stop</span>
              {sl.tightNote && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sl.tightNote}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#ef4444" }}>${sl.tight}</div>
              {sl.tightPct !== undefined && <div style={{ fontSize: 11, color: "#ef4444" }}>{sl.tightPct}%</div>}
            </div>
          </div>
        )}
        {sl.tight !== undefined && sl.hard !== undefined && <div style={{ borderBottom: "1px solid #1e1e2e" }} />}
        {sl.hard !== undefined && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: 12, color: "#64748b" }}>Hard Stop</span>
              {sl.hardNote && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sl.hardNote}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#ef4444" }}>${sl.hard}</div>
              {sl.hardPct !== undefined && <div style={{ fontSize: 11, color: "#ef4444" }}>{sl.hardPct}%</div>}
            </div>
          </div>
        )}
        {sl.riskReward && (
          <>
            <div style={{ borderBottom: "1px solid #1e1e2e" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: 12, color: "#64748b" }}>Risk/Reward</span>
                {sl.rrNote && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sl.rrNote}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#e2e8f0" }}>{sl.riskReward}</div>
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
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginBottom: 2 }}>{d.event}</div>
                  {d.note && <div style={{ fontSize: 11, color: "#475569" }}>{d.note}</div>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: dateColor }}>{d.dateRange}</div>
                  {d.est && <div style={{ fontSize: 11, color: "#64748b" }}>{d.est}</div>}
                </div>
              </div>
              {i < dates.length - 1 && <div style={{ borderBottom: "1px solid #1e1e2e", marginTop: 10 }} />}
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
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {scenarios.map((s, i) => {
          const c = SCENARIO_COLORS[s.color] ?? SCENARIO_COLORS.green;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 42, fontSize: 12, color: "#64748b", flexShrink: 0 }}>{s.label}</div>
              <div style={{ flex: 1, background: "#1e1e2e", borderRadius: 4, height: 6, overflow: "hidden" }}>
                <div style={{ width: `${(Math.abs(s.pct) / maxPct) * 100}%`, height: "100%", background: c.bar, borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: c.text, width: 52, textAlign: "right" }}>
                {s.pct < 0 ? "" : "+"}{s.pct}%
              </div>
              <div style={{ fontSize: 12, color: "#64748b", width: 40, textAlign: "right" }}>${s.price}</div>
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
    <div style={{ display: "flex", gap: 4, background: "#1e1e2e", borderRadius: 8, padding: 3 }}>
      {(["en", "th"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          style={{
            fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 6, border: "none", cursor: "pointer",
            background: lang === l ? "#3b82f6" : "transparent",
            color: lang === l ? "#fff" : "#64748b",
            transition: "background 0.15s",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
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
  const RISK_COLOR = { LOW: "#10b981", MEDIUM: "#f59e0b", HIGH: "#ef4444" };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Nav row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Link href="/" style={{ fontSize: 13, color: "#64748b", textDecoration: "none" }}>← All Reports</Link>
        <LangToggle lang={lang} hasThai={hasThai} onChange={setLang} />
      </div>

      {/* Hero */}
      <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderTop: `2px solid ${verdictColor}`, borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: "clamp(24px, 5vw, 40px)", fontWeight: 900, margin: 0, letterSpacing: "-1px" }}>{report.ticker}</h1>
              <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 12px", borderRadius: 6, background: verdictColor + "20", color: verdictColor, border: `1px solid ${verdictColor}40`, whiteSpace: "nowrap" }}>
                {report.scoreLabel ?? report.verdict}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
              {report.companyName}{report.exchange ? ` · ${report.exchange}` : ""} · {report.sector}
            </div>
            <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7, margin: 0 }}>{report.summary}</p>
          </div>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: "clamp(24px, 5vw, 32px)", fontWeight: 900, letterSpacing: "-1px" }}>${report.price.toFixed(2)}</div>
            <div style={{ fontSize: 13, color: isPositive ? "#10b981" : "#ef4444", marginBottom: 4 }}>
              {isPositive ? "▲" : "▼"} {Math.abs(report.priceChange).toFixed(2)}%
            </div>
            {report.priceNote && <div style={{ fontSize: 12, color: "#475569" }}>{report.priceNote}</div>}
          </div>
        </div>
      </div>

      {/* Row 1 — stacks to 1 col on mobile */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 12 }}>
        <CatalystCard catalysts={report.catalysts} />
        <EntryCard levels={report.entryStrategy.entryLevels} />
        <TakeProfitCard report={report} />
      </div>

      {/* Row 2 — stacks to 1 col on mobile */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 12 }}>
        <StopLossCard report={report} />
        {report.estimateDates && report.estimateDates.length > 0 ? (
          <EstimateDateCard dates={report.estimateDates} />
        ) : (
          <div style={card()}>
            <SectionTitle>📅 Estimate Date</SectionTitle>
            {report.earningsDate && <div style={{ fontSize: 14, color: "#f59e0b", fontWeight: 700 }}>Earnings: {report.earningsDate}</div>}
          </div>
        )}
        {report.scenarios && report.scenarios.length > 0 ? (
          <ScenariosCard scenarios={report.scenarios} />
        ) : (
          <div style={card()}><SectionTitle>📈 Possible Up %</SectionTitle><div style={{ fontSize: 13, color: "#64748b" }}>No scenarios data</div></div>
        )}
      </div>

      {/* Macro */}
      <div style={{ ...card(), marginBottom: 12 }}>
        <SectionTitle>
          🏛️ Fed / Macro Risk —{" "}
          <span style={{ color: RISK_COLOR[report.macroRisk.fedRisk] }}>{report.macroRisk.fedRisk}</span>
        </SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          {([
            ["Rate Outlook", report.macroRisk.rateOutlook],
            ["Inflation", report.macroRisk.inflationNote],
            ["Sector Impact", report.macroRisk.sectorImpact],
            ["Summary", report.macroRisk.summary],
          ] as [string, string][]).map(([label, val]) => (
            <div key={label} style={{ background: "#ffffff06", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
              <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.5 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Analyst */}
      {report.analystTargets && report.analystTargets.length > 0 && (
        <div style={{ ...card(), marginBottom: 12 }}>
          <SectionTitle>🎯 Analyst Targets</SectionTitle>
          {report.analystTargets.map((a, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < report.analystTargets!.length - 1 ? "1px solid #1e1e2e" : "none" }}>
              <span style={{ fontSize: 13, color: "#e2e8f0" }}>{a.firm}</span>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>{a.rating}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>${a.target}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Verdict */}
      <div style={{ ...card(), marginBottom: 12, borderLeft: `3px solid ${verdictColor}` }}>
        <SectionTitle>📝 Verdict</SectionTitle>
        <p style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>
          {report.entryStrategy.verdict}
        </p>
      </div>

      {/* Sources */}
      <div style={card()}>
        <SectionTitle>📎 Sources</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {report.sources.map((src, i) => (
            <a key={i} href={src} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#3b82f6", wordBreak: "break-all" }}>{src}</a>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#475569", marginTop: 12, marginBottom: 0 }}>
          Generated {new Date(report.generatedAt).toLocaleString()} · Not financial advice
        </p>
      </div>
    </div>
  );
}
