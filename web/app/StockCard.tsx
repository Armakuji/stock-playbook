"use client";

import Link from "next/link";
import { StockReport } from "@/lib/types";
import { marketCapTier } from "@/lib/market-cap";
import { daysToCatalyst, timingTier } from "@/lib/catalyst-timing";

const TIER_COLOR = ["#ef4444", "#f59e0b", "#3b82f6", "#64748b"];

const VERDICT_COLORS: Record<StockReport["verdict"], string> = {
  BUY: "#10b981", HOLD: "#f59e0b", SELL: "#ef4444", SPECULATIVE: "#8b5cf6",
};
const RISK_COLORS: Record<string, string> = {
  LOW: "#10b981", MEDIUM: "#f59e0b", HIGH: "#ef4444",
};
const RANK_META: Record<number, { label: string }> = {
  1: { label: "🥇 #1" },
  2: { label: "🥈 #2" },
  3: { label: "🥉 #3" },
};

// ── SVG score ring ────────────────────────────────────────────────────────────
function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(score, 100)) / 100 * circ;
  return (
    <div style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}>
      <svg width={48} height={48} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={24} cy={24} r={r} fill="none" stroke="#1e1e2e" strokeWidth={3.5} />
        <circle cx={24} cy={24} r={r} fill="none" stroke={color} strokeWidth={3.5}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          style={{ animation: "scoreArc 0.9s ease both" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 800, color, fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.5px",
      }}>
        {score}
      </div>
    </div>
  );
}

// ── Price-to-target bar ───────────────────────────────────────────────────────
function PriceBar({ report, verdictColor }: { report: StockReport; verdictColor: string }) {
  const sl = report.entryStrategy.stopLoss.tight ?? (report.price * 0.85);
  const tp3 = report.entryStrategy.tp3.price;
  const range = tp3 - sl;
  if (range <= 0) return null;

  const pos = (v: number) => Math.max(2, Math.min(98, ((v - sl) / range) * 100));

  const preferredEntry = report.entryStrategy.entryLevels.find((e) => e.preferred)?.level
    ?? report.entryStrategy.entryLevels[1]?.level
    ?? report.price;

  const curPct   = pos(report.price);
  const tp1Pct   = pos(report.entryStrategy.tp1.price);
  const tp2Pct   = pos(report.entryStrategy.tp2.price);
  const entryPct = pos(preferredEntry);

  const tp2Upside = ((report.entryStrategy.tp2.price - report.price) / report.price * 100).toFixed(0);

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)" }}>
          Price vs Targets
        </span>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>
          TP2 +{tp2Upside}%
        </span>
      </div>

      {/* Track */}
      <div style={{ position: "relative", height: 5, background: "#1a1a2e", borderRadius: 6 }}>
        {/* Filled: SL → current */}
        <div style={{
          position: "absolute", left: 0, width: `${curPct}%`, height: "100%",
          background: `linear-gradient(90deg, #ef444430, ${verdictColor}80)`,
          borderRadius: 6,
          animation: "barFill 0.8s ease both",
        }} />
        {/* Entry marker (blue) */}
        <div style={{
          position: "absolute", left: `${entryPct}%`, top: -4,
          width: 2, height: 13, background: "#3b82f6", borderRadius: 2,
          transform: "translateX(-50%)",
        }} />
        {/* TP1 tick */}
        <div style={{
          position: "absolute", left: `${tp1Pct}%`, top: -3,
          width: 1, height: 11, background: "#10b98160", borderRadius: 2,
          transform: "translateX(-50%)",
        }} />
        {/* TP2 tick */}
        <div style={{
          position: "absolute", left: `${tp2Pct}%`, top: -3,
          width: 2, height: 11, background: "#10b981", borderRadius: 2,
          transform: "translateX(-50%)",
        }} />
        {/* Current price dot */}
        <div style={{
          position: "absolute", left: `${curPct}%`, top: "50%",
          width: 10, height: 10, borderRadius: "50%",
          background: verdictColor, border: "2px solid var(--surface, var(--card))",
          transform: "translate(-50%, -50%)",
          boxShadow: `0 0 8px ${verdictColor}`,
        }} />
      </div>

      {/* Labels below bar */}
      <div style={{ position: "relative", height: 18, marginTop: 5 }}>
        <span style={{
          position: "absolute", left: `${entryPct}%`, fontSize: 8,
          color: "#3b82f6", transform: "translateX(-50%)",
          fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap",
        }}>
          ENTRY
        </span>
        <span style={{
          position: "absolute", left: `${tp2Pct}%`, fontSize: 8,
          color: "#10b981", transform: "translateX(-50%)",
          fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap",
        }}>
          TP2
        </span>
      </div>
    </div>
  );
}

// ── Conviction drift arrow ────────────────────────────────────────────────────
function DriftIndicator({ drift }: { drift: number | null }) {
  if (drift === null) return null;
  const up   = drift >= 5;
  const down = drift <= -5;
  const color = up ? "#10b981" : down ? "#ef4444" : "#64748b";
  const arrow = up ? "↑" : down ? "↓" : "→";
  const label = drift > 0 ? `+${drift}` : drift === 0 ? "" : `${drift}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
      <span style={{ fontSize: 13, lineHeight: 1, color, fontWeight: 800 }}>{arrow}</span>
      {label && (
        <span style={{ fontSize: 8, color, fontFamily: "var(--font-mono, monospace)", fontWeight: 700, lineHeight: 1 }}>
          {label}
        </span>
      )}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────
export function StockCard({ report, rank, rankScore, scoreDrift = null }: {
  report: StockReport;
  rank: number;
  rankScore: number;
  scoreDrift?: number | null;
}) {
  const verdictColor = VERDICT_COLORS[report.verdict] ?? "#64748b";
  const riskColor    = RISK_COLORS[report.macroRisk.fedRisk] ?? "#64748b";
  const isPositive   = report.priceChange >= 0;
  const rankMeta     = RANK_META[rank];
  const cap          = marketCapTier(report.marketCap);
  const dToc         = daysToCatalyst(report);
  const tocColor     = TIER_COLOR[timingTier(dToc)];

  return (
    <Link href={`/report/${report.ticker}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "var(--surface, var(--card))",
          border: "1px solid var(--brd, var(--border))",
          borderTop: `2px solid ${verdictColor}`,
          borderRadius: 14,
          padding: "18px 20px",
          cursor: "pointer",
          transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
          position: "relative",
          overflow: "hidden",
          height: "100%",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = verdictColor;
          el.style.transform = "translateY(-3px)";
          el.style.boxShadow = `0 8px 32px ${verdictColor}20, 0 2px 8px rgba(0,0,0,0.5)`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "var(--brd, var(--border))";
          el.style.borderTopColor = verdictColor;
          el.style.transform = "translateY(0)";
          el.style.boxShadow = "none";
        }}
      >
        {/* Verdict glow wash */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 90,
          background: `linear-gradient(180deg, ${verdictColor}10 0%, transparent 100%)`,
          pointerEvents: "none",
        }} />

        {/* Row 1: rank + score ring */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
            background: `${verdictColor}18`, color: verdictColor,
            border: `1px solid ${verdictColor}30`,
            fontFamily: "var(--font-mono, monospace)",
          }}>
            {rankMeta?.label ?? `#${rank}`}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <DriftIndicator drift={scoreDrift} />
            <ScoreRing score={report.score ?? rankScore} color={verdictColor} />
          </div>
        </div>

        {/* Row 2: ticker + verdict (the call) · company · meta chips (the facts) */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 22, fontWeight: 800, color: "var(--text)",
              fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.5px",
            }}>
              {report.ticker}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 5,
              background: `${verdictColor}1e`, color: verdictColor,
              border: `1px solid ${verdictColor}3a`, letterSpacing: "0.5px", whiteSpace: "nowrap",
            }}>
              {report.verdict}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{report.companyName}</div>

          {/* Static facts: cap size + days-to-catalyst — kept off the headline line */}
          {(cap || dToc !== null) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
              {cap && (
                <span
                  title={`${cap.label} · ${report.marketCap ?? ""}`}
                  style={{
                    fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 5,
                    background: cap.bg, color: cap.color, border: `1px solid ${cap.color}3a`,
                    letterSpacing: "0.5px", whiteSpace: "nowrap", fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  {cap.short}
                </span>
              )}
              {dToc !== null && (
                <span
                  title="Days to next catalyst"
                  style={{
                    fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 5,
                    background: `${tocColor}1c`, color: tocColor, border: `1px solid ${tocColor}3a`,
                    letterSpacing: "0.5px", whiteSpace: "nowrap", fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  ⏱ {dToc <= 0 ? "today" : `${dToc}d`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Row 3: price + change */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
          marginBottom: 12,
        }}>
          <span style={{
            fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px",
            fontFamily: "var(--font-mono, monospace)",
          }}>
            ${report.price.toFixed(2)}
          </span>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
            color: isPositive ? "#10b981" : "#ef4444",
            background: isPositive ? "#10b98118" : "#ef444418",
            fontFamily: "var(--font-mono, monospace)",
          }}>
            {isPositive ? "▲" : "▼"} {Math.abs(report.priceChange).toFixed(2)}%
          </span>
        </div>

        {/* Row 4: summary */}
        <p style={{
          fontSize: 12, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 12px",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {report.summary}
        </p>

        {/* Row 5: stat chips */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {[
            { label: "Fed Risk",  value: report.macroRisk.fedRisk,         color: riskColor        },
            { label: "Approach",  value: report.entryStrategy.approach,     color: "var(--text)"    },
            { label: "Sector",    value: report.sector?.split("/")[0]?.trim() ?? "—", color: "var(--muted)" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: "#ffffff07", borderRadius: 8, padding: "7px 9px",
              border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: 9, color: "var(--muted)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color, fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Row 6: Price-to-target bar */}
        <PriceBar report={report} verdictColor={verdictColor} />
      </div>
    </Link>
  );
}
