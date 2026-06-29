"use client";

import Link from "next/link";
import { StockReport } from "@/lib/types";
import { marketCapTier } from "@/lib/market-cap";
import { useLang } from "@/lib/LanguageContext";

// ── Ice score ring — calm counterpart to the turbo flame ring ────────────────
function IceRing({ score }: { score: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(score, 100) / 100) * circ;
  return (
    <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
      <svg width={52} height={52} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={26} cy={26} r={r} fill="none" stroke="#0d1f29" strokeWidth={4} />
        <circle
          cx={26} cy={26} r={r} fill="none"
          stroke="url(#iceGrad)" strokeWidth={4}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 4px #38bdf8)" }}
        />
        <defs>
          <linearGradient id="iceGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontSize: 15, fontWeight: 900, color: "#7dd3fc",
          fontFamily: "var(--font-mono, monospace)", lineHeight: 1, letterSpacing: "-0.5px",
          filter: "drop-shadow(0 0 4px #38bdf855)",
        }}>
          {Math.round(score)}
        </span>
        <span style={{ fontSize: 7, color: "#4a6b78", fontFamily: "var(--font-mono, monospace)", marginTop: 1 }}>
          DCA
        </span>
      </div>
    </div>
  );
}

const ZONE = {
  cheap:     { color: "#10b981", labelTh: "ถูกกว่า fair · สะสมได้", labelEn: "below fair · accumulate" },
  fair:      { color: "#38bdf8", labelTh: "ใกล้ fair · ทยอยเข้า",   labelEn: "near fair · scale in" },
  expensive: { color: "#f59e0b", labelTh: "แพงกว่า fair · รอย่อ",   labelEn: "above fair · wait for dip" },
} as const;

// ── Valuation gauge — replaces catalyst countdown ────────────────────────────
function ValuationGauge({ report, th }: { report: StockReport; th: boolean }) {
  const vb = report.valuationBand;
  if (!vb) return null;
  const zone = ZONE[vb.zone] ?? ZONE.fair;
  // map currentVsFair across a -25%..+25% track
  const marker = Math.max(3, Math.min(97, ((vb.currentVsFair + 25) / 50) * 100));

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #102530" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{
          fontSize: 9, color: "#4a6b78", textTransform: "uppercase",
          letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)",
        }}>
          {th ? "มูลค่า vs Fair" : "Valuation vs Fair"}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 800, color: zone.color,
          fontFamily: "var(--font-mono, monospace)",
        }}>
          {vb.currentVsFair >= 0 ? "+" : ""}{vb.currentVsFair.toFixed(0)}%
        </span>
      </div>

      <div style={{ position: "relative", height: 6, borderRadius: 6, overflow: "hidden", background: "#0d1f29" }}>
        {/* cheap | fair | expensive zones */}
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          <div style={{ flex: 1, background: "#10b98122" }} />
          <div style={{ flex: 1, background: "#38bdf822" }} />
          <div style={{ flex: 1, background: "#f59e0b22" }} />
        </div>
        {/* current price marker */}
        <div style={{
          position: "absolute", left: `${marker}%`, top: "50%",
          width: 10, height: 10, borderRadius: "50%",
          background: zone.color, border: "2px solid #07111a",
          transform: "translate(-50%, -50%)",
          boxShadow: `0 0 8px ${zone.color}`,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 8, color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>cheap</span>
        <span style={{ fontSize: 8, color: "#38bdf8", fontFamily: "var(--font-mono, monospace)" }}>fair</span>
        <span style={{ fontSize: 8, color: "#f59e0b", fontFamily: "var(--font-mono, monospace)" }}>rich</span>
      </div>
      <div style={{ fontSize: 10, color: zone.color, marginTop: 6, fontWeight: 700 }}>
        {th ? zone.labelTh : zone.labelEn}
      </div>
    </div>
  );
}

// ── Quality mini-bars (moat / margin / FCF / balance) ────────────────────────
function QualityBars({ report }: { report: StockReport }) {
  const q = report.qualityScore;
  if (!q) return null;
  const rows: [string, number][] = [
    ["Moat", q.moat],
    ["Margin", q.marginTrend],
    ["FCF", q.fcf],
    ["Balance", q.balanceSheet],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginTop: 12 }}>
      {rows.map(([label, v]) => (
        <div key={label}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 9, color: "#4a6b78", fontFamily: "var(--font-mono, monospace)" }}>{label}</span>
            <span style={{ fontSize: 9, color: "#7dd3fc", fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>
              {v.toFixed(1)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: n <= Math.round(v) ? "#38bdf8" : "#102530",
              }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Fund info chips (ETF "กองทุน" mode — replaces quality bars) ───────────────
function FundChips({ report, th }: { report: StockReport; th: boolean }) {
  const f = report.fundInfo;
  if (!f) return null;
  const chips: { label: string; value: string }[] = [
    { label: th ? "ตามดัชนี" : "Tracks", value: f.tracks },
    { label: th ? "ค่าธรรมเนียม" : "Expense", value: `${f.expenseRatio.toFixed(2)}%` },
    ...(f.yield != null ? [{ label: th ? "ปันผล" : "Yield", value: `${f.yield.toFixed(1)}%` }] : []),
    ...(f.cagr10y != null ? [{ label: th ? "CAGR 10y" : "10y CAGR", value: `${f.cagr10y.toFixed(0)}%` }] : []),
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginTop: 12 }}>
      {chips.map((c) => (
        <div key={c.label}>
          <div style={{ fontSize: 9, color: "#4a6b78", marginBottom: 2, fontFamily: "var(--font-mono, monospace)" }}>{c.label}</div>
          <div style={{ fontSize: 12, color: "#7dd3fc", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Rank badge ───────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 6,
      background: "#38bdf818", color: "#7dd3fc",
      border: "1px solid #38bdf830",
      fontFamily: "var(--font-mono, monospace)",
    }}>
      {medals[rank - 1] ?? `#${rank}`}
    </span>
  );
}

export function DcaCard({ report, rank }: { report: StockReport; rank: number }) {
  const { lang } = useLang();
  const th = lang === "th";
  const isFund = report.assetType === "fund";
  const isPositive = report.priceChange >= 0;
  const cap = marketCapTier(report.marketCap);
  const score = report.dcaScore ?? report.score ?? 0;
  const cadence = report.dcaPlan?.cadence;
  const weight = report.dcaPlan?.targetWeight;

  return (
    <Link href={`/report/${report.ticker}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "#07111a",
          border: "1px solid #102530",
          borderTop: "2px solid #38bdf8",
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
          el.style.borderTopColor = "#7dd3fc";
          el.style.borderColor = "#38bdf860";
          el.style.transform = "translateY(-3px)";
          el.style.boxShadow = "0 8px 32px #38bdf822, 0 2px 8px rgba(0,0,0,0.7)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "#102530";
          el.style.borderTopColor = "#38bdf8";
          el.style.transform = "translateY(0)";
          el.style.boxShadow = "none";
        }}
      >
        {/* cool glow wash */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 100,
          background: "linear-gradient(180deg, #38bdf812 0%, transparent 100%)",
          pointerEvents: "none",
        }} />

        {/* Row 1: rank + score ring */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <RankBadge rank={rank} />
          <IceRing score={score} />
        </div>

        {/* Row 2: ticker + label */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 22, fontWeight: 800, color: "#eaf6ff",
              fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.5px",
            }}>
              {report.ticker}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 5,
              background: "#38bdf81e", color: "#7dd3fc",
              border: "1px solid #38bdf83a", letterSpacing: "0.5px",
            }}>
              {report.scoreLabel ?? (isFund ? "ETF" : "Core Holding")}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#4a6b78" }}>{report.companyName}</div>

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

          <div style={{ fontSize: 10, color: "#3a5560", marginTop: 4, fontStyle: "italic" }}>
            {report.companyDescription}
          </div>
        </div>

        {/* Row 3: price */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 0", borderTop: "1px solid #102530", borderBottom: "1px solid #102530",
          marginBottom: 12,
        }}>
          <span style={{
            fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px",
            fontFamily: "var(--font-mono, monospace)", color: "#eaf6ff",
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
            {weight && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#2dd4bf", fontFamily: "var(--font-mono, monospace)" }}>
                🎯 {weight} {th ? "ของพอร์ต" : "of port"}
              </span>
            )}
            {cadence && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#7dd3fc", fontFamily: "var(--font-mono, monospace)" }}>
                🔁 {cadence}
              </span>
            )}
          </div>
        </div>

        {/* Row 4: summary */}
        <p style={{
          fontSize: 12, color: "#5a7a86", lineHeight: 1.6, margin: "0 0 4px",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {report.summary}
        </p>

        {/* Row 5: quality bars (stock) or fund info chips (ETF) */}
        {isFund ? <FundChips report={report} th={th} /> : <QualityBars report={report} />}

        {/* Row 6: valuation gauge */}
        <ValuationGauge report={report} th={th} />
      </div>
    </Link>
  );
}
