"use client";

import Link from "next/link";
import { StockReport } from "@/lib/types";
import { marketCapTier } from "@/lib/market-cap";
import { useLang } from "@/lib/LanguageContext";

// ── Flame ring — replaces green score ring ────────────────────────────────────
function FlameRing({ moonPct }: { moonPct: number }) {
  // cap at 500% for visual ring
  const p = Math.min(moonPct, 500) / 500 * 100;
  return (
    <div className="radar-ring" style={{ "--p": p } as React.CSSProperties}>
      <div className="radar-ring-in" style={{ gap: 3 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, color: "#ff6d00",
          fontFamily: "var(--font-mono, monospace)", lineHeight: 1, letterSpacing: "-0.5px",
        }}>
          🌙
        </span>
        <span style={{
          fontSize: 10, fontWeight: 900, color: "#ff6d00",
          fontFamily: "var(--font-mono, monospace)", lineHeight: 1, letterSpacing: "-0.5px",
        }}>
          {moonPct > 999 ? "999+" : `${Math.round(moonPct)}%`}
        </span>
      </div>
    </div>
  );
}

// ── Moon upside bar ───────────────────────────────────────────────────────────
function TurboBar({ report, moonPct }: { report: StockReport; moonPct: number }) {
  const moonPrice = report.scenarios?.find((s) => s.label === "Moon")?.price
    ?? report.entryStrategy.tp3.price;
  const sl = report.entryStrategy.stopLoss.tight ?? report.price * 0.85;
  const range = moonPrice - sl;
  if (range <= 0) return null;

  const pos = (v: number) => Math.max(2, Math.min(98, ((v - sl) / range) * 100));
  const curPct = pos(report.price);
  const tp1Pct = pos(report.entryStrategy.tp1.price);
  const tp3Pct = pos(report.entryStrategy.tp3.price);

  return (
    <div className="moon">
      <div className="mrow">
        <span className="mlab">Price → Moon</span>
        <span className="mval">🌙 +{Math.round(moonPct)}%</span>
      </div>

      <div className="mbar">
        {/* filled zone */}
        <span className="mfill" style={{ width: `${curPct}%` }} />
        {/* TP1 tick */}
        <div style={{
          position: "absolute", left: `${tp1Pct}%`, top: -3, width: 1, height: 11,
          background: "#ff6d0060", borderRadius: 2, transform: "translateX(-50%)",
        }} />
        {/* TP3 / moon tick */}
        <span className="mtick" style={{ left: `${tp3Pct}%` }} />
        {/* current price dot */}
        <div className="radar-mk" style={{ left: `${curPct}%`, background: "#ff3d00", boxShadow: "0 0 8px #ff3d00" }} />
      </div>

      <div className="mend">
        <span className="mmoon" style={{ left: `${tp3Pct}%` }}>🌙 MOON</span>
      </div>
    </div>
  );
}

// ── Rank badge ────────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 6,
      background: "#ff3d0018", color: "#ff6d00",
      border: "1px solid #ff3d0030",
      fontFamily: "var(--font-mono, monospace)",
    }}>
      {medals[rank - 1] ?? `#${rank}`}
    </span>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────
export function TurboCard({
  report,
  rank,
  moonPct,
  bullPct,
}: {
  report: StockReport;
  rank: number;
  moonPct: number;
  bullPct: number;
}) {
  const { lang } = useLang();
  const th = lang === "th";
  const isPositive = report.priceChange >= 0;
  const moonPrice = report.scenarios?.find((s) => s.label === "Moon")?.price
    ?? report.entryStrategy.tp3.price;
  const cap = marketCapTier(report.marketCap);

  return (
    <Link href={`/report/${report.ticker}`} className="radar-card">
        {/* Row 1: rank + moon ring */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <RankBadge rank={rank} />
          <FlameRing moonPct={moonPct} />
        </div>

        {/* Row 2: ticker + label */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 22, fontWeight: 800, color: "#fff1f1",
              fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.5px",
            }}>
              {report.ticker}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 5,
              background: "#ff3d001e", color: "#ff6d00",
              border: "1px solid #ff3d003a", letterSpacing: "0.5px",
            }}>
              {report.scoreLabel ?? "ค่าขนม"}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#7f4040" }}>{report.companyName}</div>

          {/* Cap size badge */}
          {cap && (
            <div style={{ marginTop: 6 }}>
              <span
                title={`${cap.label} · ${report.marketCap ?? ""}`}
                style={{
                  fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 5,
                  background: cap.bg, color: cap.color, border: `1px solid ${cap.color}3a`,
                  letterSpacing: "0.5px", whiteSpace: "nowrap",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                {cap.short}
              </span>
            </div>
          )}

          <div style={{ fontSize: 10, color: "#4d2020", marginTop: 4, fontStyle: "italic" }}>
            {report.companyDescription}
          </div>
        </div>

        {/* Row 3: price */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 0", borderTop: "1px solid #2d1010", borderBottom: "1px solid #2d1010",
          marginBottom: 12,
        }}>
          <span style={{
            fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px",
            fontFamily: "var(--font-mono, monospace)", color: "#fff1f1",
          }}>
            ${report.price.toFixed(2)}
          </span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
              color: isPositive ? "#10b981" : "#ef4444",
              background: isPositive ? "#10b98118" : "#ef444418",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              {isPositive ? "▲" : "▼"} {Math.abs(report.priceChange).toFixed(2)}%
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#ff6d00",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              🔥 +{Math.round(bullPct)}% bull
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#d500f9",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              🌙 ${moonPrice.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Row 4: summary */}
        <p style={{
          fontSize: 12, color: "#7f4040", lineHeight: 1.6, margin: "0 0 12px",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {report.summary}
        </p>

        {/* Row 5: stat chips */}
        <div className="tchips">
          {[
            {
              label: th ? "มาร์เก็ตแคป" : "Market Cap",
              value: report.marketCap ?? "—",
              color: "#ff6d00",
            },
            {
              label: th ? "ความเสี่ยง Fed" : "Fed Risk",
              value: report.macroRisk.fedRisk,
              color: report.macroRisk.fedRisk === "LOW"
                ? "#10b981"
                : report.macroRisk.fedRisk === "MEDIUM"
                ? "#f59e0b"
                : "#ef4444",
            },
            {
              label: th ? "จุดตัดขาดทุน" : "Stop Loss",
              value: report.entryStrategy.stopLoss.tight
                ? `$${report.entryStrategy.stopLoss.tight}`
                : "—",
              color: "#ef4444",
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="tchip">
              <div className="cl">{label}</div>
              <div className="cv" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Row 6: Turbo bar */}
        <TurboBar report={report} moonPct={moonPct} />
    </Link>
  );
}
