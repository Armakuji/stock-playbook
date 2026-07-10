"use client";

import Link from "next/link";
import { StockReport } from "@/lib/types";
import { marketCapTier } from "@/lib/market-cap";
import { useLang } from "@/lib/LanguageContext";

// ── Ice score ring — calm counterpart to the turbo flame ring ────────────────
function IceRing({ score }: { score: number }) {
  return (
    <div className="radar-ring" style={{ "--p": Math.max(0, Math.min(score, 100)) } as React.CSSProperties}>
      <div className="radar-ring-in">
        <span style={{
          fontSize: 15, fontWeight: 900, color: "#7dd3fc",
          fontFamily: "var(--font-mono, monospace)", lineHeight: 1, letterSpacing: "-0.5px",
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
    <div className="gauge">
      <div className="grow">
        <span className="glab">
          {th ? "มูลค่า vs Fair" : "Valuation vs Fair"}
        </span>
        <span className="gval" style={{ color: zone.color }}>
          {vb.currentVsFair >= 0 ? "+" : ""}{vb.currentVsFair.toFixed(0)}%
        </span>
      </div>

      <div className="gbar">
        {/* cheap | fair | expensive zones */}
        <i className="gz1" />
        <i className="gz2" />
        <i className="gz3" />
        {/* current price marker */}
        <div className="radar-mk" style={{ left: `${marker}%`, background: zone.color, boxShadow: `0 0 8px ${zone.color}` }} />
      </div>
      <div className="gends">
        <span style={{ color: "#10b981" }}>cheap</span>
        <span style={{ color: "#38bdf8" }}>fair</span>
        <span style={{ color: "#f59e0b" }}>rich</span>
      </div>
      <div className="zline" style={{ color: zone.color }}>
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
    <div className="chips" style={{ marginTop: 12 }}>
      {chips.map((c) => (
        <div key={c.label} className="chip2">
          <div className="cl">{c.label}</div>
          <div className="cv">{c.value}</div>
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
    <Link href={`/report/${report.ticker}`} className="radar-card">
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
    </Link>
  );
}
