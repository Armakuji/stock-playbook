"use client";

import Link from "next/link";
import { StockReport } from "@/lib/types";

const VERDICT_COLORS: Record<StockReport["verdict"], string> = {
  BUY: "#10b981",
  HOLD: "#f59e0b",
  SELL: "#ef4444",
  SPECULATIVE: "#8b5cf6",
};

const RISK_COLORS: Record<string, string> = {
  LOW: "#10b981",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
};

const RANK_META: Record<number, { label: string; glow: string }> = {
  1: { label: "🥇 #1", glow: "rgba(245,158,11,0.18)" },
  2: { label: "🥈 #2", glow: "rgba(148,163,184,0.12)" },
  3: { label: "🥉 #3", glow: "rgba(180,82,16,0.15)" },
};

// SVG arc score ring
function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(score, 100)) / 100 * circ;
  return (
    <div style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}>
      <svg width={48} height={48} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={24} cy={24} r={r} fill="none" stroke="#1e1e2e" strokeWidth={3.5} />
        <circle
          cx={24} cy={24} r={r} fill="none" stroke={color} strokeWidth={3.5}
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          style={{ animation: "scoreArc 0.9s ease both", transition: "stroke-dasharray 0.9s ease" }}
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

export function StockCard({ report, rank, rankScore }: {
  report: StockReport;
  rank: number;
  rankScore: number;
}) {
  const verdictColor = VERDICT_COLORS[report.verdict] ?? "#64748b";
  const riskColor = RISK_COLORS[report.macroRisk.fedRisk] ?? "#64748b";
  const isPositive = report.priceChange >= 0;
  const rankMeta = RANK_META[rank];

  const tp2Upside = (((report.entryStrategy.tp2.price - report.price) / report.price) * 100).toFixed(0);

  return (
    <Link href={`/report/${report.ticker}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "var(--card)",
          border: `1px solid var(--border)`,
          borderTop: `2px solid ${verdictColor}`,
          borderRadius: 14,
          padding: "18px 20px",
          cursor: "pointer",
          transition: "border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
          position: "relative",
          overflow: "hidden",
          animation: "cardIn 0.4s ease both",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = verdictColor;
          el.style.transform = "translateY(-3px)";
          el.style.boxShadow = `0 8px 30px ${verdictColor}22, 0 2px 8px rgba(0,0,0,0.4)`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "var(--border)";
          el.style.borderTopColor = verdictColor;
          el.style.transform = "translateY(0)";
          el.style.boxShadow = "none";
        }}
      >
        {/* Subtle gradient glow in bg */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 80,
          background: `linear-gradient(180deg, ${verdictColor}0d 0%, transparent 100%)`,
          pointerEvents: "none",
        }} />

        {/* Top row: rank badge + score ring */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
            background: `${verdictColor}18`,
            color: verdictColor,
            border: `1px solid ${verdictColor}30`,
            fontFamily: "var(--font-mono, monospace)",
          }}>
            {rankMeta?.label ?? `#${rank}`}
          </span>
          <ScoreRing score={report.score ?? rankScore} color={verdictColor} />
        </div>

        {/* Ticker + company + verdict badge */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
            <span style={{
              fontSize: 22, fontWeight: 800, color: "var(--text)",
              fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.5px",
            }}>
              {report.ticker}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 5,
              background: `${verdictColor}1e`, color: verdictColor,
              border: `1px solid ${verdictColor}3a`,
              letterSpacing: "0.5px", whiteSpace: "nowrap",
            }}>
              {report.verdict}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.3 }}>{report.companyName}</div>
        </div>

        {/* Price row */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", fontFamily: "var(--font-mono, monospace)" }}>
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

        {/* Summary */}
        <p style={{
          fontSize: 12, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 14px",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {report.summary}
        </p>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {[
            { label: "Fed Risk", value: report.macroRisk.fedRisk, color: riskColor },
            { label: "TP2 Upside", value: `+${tp2Upside}%`, color: "#10b981" },
            { label: "Approach", value: report.entryStrategy.approach, color: "var(--text)" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#ffffff07", borderRadius: 8, padding: "7px 9px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 9, color: "var(--muted)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color, fontFamily: "var(--font-mono, monospace)" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}
