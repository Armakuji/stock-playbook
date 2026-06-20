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

const RANK_STYLES: Record<number, { bg: string; color: string; label: string }> = {
  1: { bg: "#f59e0b20", color: "#f59e0b", label: "🥇 #1" },
  2: { bg: "#94a3b820", color: "#94a3b8", label: "🥈 #2" },
  3: { bg: "#b4521020", color: "#b45210", label: "🥉 #3" },
};

export function StockCard({ report, rank, rankScore }: {
  report: StockReport;
  rank: number;
  rankScore: number;
}) {
  const verdictColor = VERDICT_COLORS[report.verdict] ?? "#64748b";
  const riskColor = RISK_COLORS[report.macroRisk.fedRisk] ?? "#64748b";
  const isPositive = report.priceChange >= 0;
  const rankStyle = RANK_STYLES[rank];

  // Upside to TP2
  const tp2Upside = (((report.entryStrategy.tp2.price - report.price) / report.price) * 100).toFixed(0);

  return (
    <Link href={`/report/${report.ticker}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderTop: `2px solid ${verdictColor}`,
          borderRadius: 12,
          padding: 20,
          cursor: "pointer",
          transition: "border-color 0.15s, transform 0.1s",
          position: "relative",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = verdictColor;
          el.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "var(--border)";
          el.style.borderTopColor = verdictColor;
          el.style.transform = "translateY(0)";
        }}
      >
        {/* Rank badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            padding: "2px 8px", borderRadius: 4,
            background: rankStyle?.bg ?? "#ffffff10",
            color: rankStyle?.color ?? "#64748b",
          }}>
            {rankStyle?.label ?? `#${rank}`}
          </span>
          <span style={{ fontSize: 11, color: "#475569" }}>Score {rankScore}/100</span>
        </div>

        {/* Ticker + price */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{report.ticker}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                background: verdictColor + "20", color: verdictColor, border: `1px solid ${verdictColor}40`,
              }}>
                {report.verdict}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{report.companyName}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>${report.price.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: isPositive ? "#10b981" : "#ef4444" }}>
              {isPositive ? "▲" : "▼"} {Math.abs(report.priceChange).toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Summary */}
        <p style={{
          fontSize: 12, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 12px",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {report.summary}
        </p>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <div style={{ background: "#ffffff06", borderRadius: 6, padding: "6px 8px" }}>
            <div style={{ fontSize: 10, color: "#475569", marginBottom: 2 }}>Fed Risk</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: riskColor }}>{report.macroRisk.fedRisk}</div>
          </div>
          <div style={{ background: "#ffffff06", borderRadius: 6, padding: "6px 8px" }}>
            <div style={{ fontSize: 10, color: "#475569", marginBottom: 2 }}>TP2 Upside</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>+{tp2Upside}%</div>
          </div>
          <div style={{ background: "#ffffff06", borderRadius: 6, padding: "6px 8px" }}>
            <div style={{ fontSize: 10, color: "#475569", marginBottom: 2 }}>Approach</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{report.entryStrategy.approach}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
