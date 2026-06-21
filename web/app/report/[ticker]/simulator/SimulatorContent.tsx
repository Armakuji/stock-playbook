"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { StockReport } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lang = "en" | "th";
type InputMode = "amount" | "shares";

interface DcaRow {
  price: number;
  sharesAmt: number;
}

interface ScaleOut {
  tp1: number; // % of position to sell at each TP
  tp2: number;
  tp3: number;
}

interface ScenarioProbs {
  bear: number;
  base: number;
  bull: number;
  moon: number;
}

interface LevelCalc {
  label: string;
  key: string;
  exitPrice: number;
  positionValue: number;
  pnlDollar: number;
  pnlPct: number;
  pnlPortfolioPct: number | null;
  pnlThb: number | null;
  rrTight: number | null;
  rrHard: number | null;
  isProfit: boolean;
  isStop: boolean;
}

interface ScaleOutResult {
  blendedPnlDollar: number;
  blendedPnlPct: number;
  blendedPnlThb: number | null;
  remainingPct: number;
  breakdown: { label: string; pct: number; pnlDollar: number }[];
}

interface EV {
  dollar: number;
  pct: number;
  thb: number | null;
  breakdown: { label: string; prob: number; pnlDollar: number }[];
}

// ─── Formatting helpers ────────────────────────────────────────────────────────

function fmt(n: number, d = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtDollar(n: number, sign = true): string {
  const s = n < 0 ? "-" : sign ? "+" : "";
  return `${s}$${fmt(Math.abs(n))}`;
}
function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${fmt(n, 2)}%`;
}
function fmtShares(n: number): string {
  return n === Math.floor(n) ? fmt(n, 0) : fmt(n, 4);
}

// ─── Color helpers ─────────────────────────────────────────────────────────────

function rrColor(rr: number | null): string {
  if (rr === null) return "var(--muted)";
  if (rr >= 3) return "#10b981";
  if (rr >= 2) return "#f59e0b";
  return "#ef4444";
}
function rrBadge(rr: number | null): string {
  if (rr === null) return "—";
  const flag = rr >= 3 ? " ✓" : rr >= 2 ? "" : " ⚠";
  return `${fmt(rr, 1)}:1${flag}`;
}

// ─── Core calculation engine ───────────────────────────────────────────────────

function calcLevels(
  shares: number,
  totalCost: number,
  entryPrice: number,
  tp1: number,
  tp2: number,
  tp3: number,
  tightStop: number,
  hardStop: number,
  portfolioSize: number | null,
  fxRate: number | null
): LevelCalc[] {
  const rows = [
    { label: "TP1", key: "tp1", exitPrice: tp1, isStop: false },
    { label: "TP2", key: "tp2", exitPrice: tp2, isStop: false },
    { label: "TP3", key: "tp3", exitPrice: tp3, isStop: false },
    { label: "Tight Stop", key: "tight", exitPrice: tightStop, isStop: true },
    { label: "Hard Stop", key: "hard", exitPrice: hardStop, isStop: true },
  ];

  const tightRisk = entryPrice - tightStop;
  const hardRisk = entryPrice - hardStop;

  return rows.map(({ label, key, exitPrice, isStop }) => {
    const positionValue = shares * exitPrice;
    const pnlDollar = positionValue - totalCost;
    const pnlPct = totalCost > 0 ? (pnlDollar / totalCost) * 100 : 0;
    const pnlPortfolioPct = portfolioSize && portfolioSize > 0 ? (pnlDollar / portfolioSize) * 100 : null;
    const pnlThb = fxRate && fxRate > 0 ? pnlDollar * fxRate : null;

    const upside = exitPrice - entryPrice;
    const rrTight = !isStop && tightRisk > 0 ? upside / tightRisk : null;
    const rrHard = !isStop && hardRisk > 0 ? upside / hardRisk : null;

    return {
      label, key, exitPrice, positionValue,
      pnlDollar, pnlPct, pnlPortfolioPct, pnlThb,
      rrTight, rrHard,
      isProfit: pnlDollar >= 0,
      isStop,
    };
  });
}

function calcScaleOut(
  shares: number,
  totalCost: number,
  entryPrice: number,
  tp1: number,
  tp2: number,
  tp3: number,
  scaleOut: ScaleOut,
  fxRate: number | null
): ScaleOutResult {
  const allocations = [
    { label: "TP1", tp: tp1, pct: scaleOut.tp1 },
    { label: "TP2", tp: tp2, pct: scaleOut.tp2 },
    { label: "TP3", tp: tp3, pct: scaleOut.tp3 },
  ];

  const totalAllocPct = scaleOut.tp1 + scaleOut.tp2 + scaleOut.tp3;
  let blendedPnlDollar = 0;

  const breakdown = allocations.map(({ label, tp, pct }) => {
    const sharesHere = shares * (pct / 100);
    const costHere = sharesHere * entryPrice;
    const pnlHere = sharesHere * (tp - entryPrice);
    blendedPnlDollar += pnlHere;
    return { label, pct, pnlDollar: pnlHere };
  });

  const blendedPnlPct = totalCost > 0 ? (blendedPnlDollar / totalCost) * 100 : 0;
  const blendedPnlThb = fxRate ? blendedPnlDollar * fxRate : null;
  const remainingPct = Math.max(0, 100 - totalAllocPct);

  return { blendedPnlDollar, blendedPnlPct, blendedPnlThb, remainingPct, breakdown };
}

function calcEV(
  shares: number,
  totalCost: number,
  entryPrice: number,
  scenarios: { label: string; pct: number }[],
  probs: number[],
  fxRate: number | null
): EV {
  let evDollar = 0;
  const breakdown = scenarios.map((s, i) => {
    const exitPrice = entryPrice * (1 + s.pct / 100);
    const pnlDollar = shares * (exitPrice - entryPrice);
    const prob = probs[i] / 100;
    evDollar += prob * pnlDollar;
    return { label: s.label, prob: probs[i], pnlDollar };
  });

  const evPct = totalCost > 0 ? (evDollar / totalCost) * 100 : 0;
  const evThb = fxRate ? evDollar * fxRate : null;

  return { dollar: evDollar, pct: evPct, thb: evThb, breakdown };
}

function calcDcaBlend(rows: DcaRow[]): { blendedPrice: number; totalShares: number; totalCost: number } {
  const totalCost = rows.reduce((s, r) => s + r.price * r.sharesAmt, 0);
  const totalShares = rows.reduce((s, r) => s + r.sharesAmt, 0);
  return { blendedPrice: totalShares > 0 ? totalCost / totalShares : 0, totalShares, totalCost };
}

// ─── Animated counter hook ─────────────────────────────────────────────────────

function useAnimatedNumber(target: number, duration = 450): number {
  const [val, setVal] = useState(target);
  const prev = useRef(target);
  const frame = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const diff = target - from;
    if (Math.abs(diff) < 0.001) { setVal(target); return; }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(from + diff * ease);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else { setVal(target); prev.current = target; }
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return val;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: "20px 22px",
  ...extra,
});

function Label({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 800, letterSpacing: "1.5px",
      color: muted ? "var(--dim)" : "var(--muted)",
      textTransform: "uppercase",
      fontFamily: "var(--font-mono, monospace)",
      marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

function InputField({
  value, onChange, prefix = "$", suffix, placeholder = "0", min = 0,
}: {
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  min?: number;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      background: "#0a0a14", border: "1px solid var(--border-bright)",
      borderRadius: 8, overflow: "hidden",
    }}>
      {prefix && (
        <span style={{ padding: "0 10px", fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", flexShrink: 0 }}>
          {prefix}
        </span>
      )}
      <input
        type="number"
        min={min}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, background: "transparent", border: "none", outline: "none",
          color: "var(--text)", fontSize: 15, fontWeight: 700,
          fontFamily: "var(--font-mono, monospace)", padding: "10px 8px 10px 0",
          minWidth: 0,
        }}
      />
      {suffix && (
        <span style={{ padding: "0 10px", fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", flexShrink: 0 }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

function Slider({
  value, onChange, max = 100, color = "#10b981",
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  color?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <input
        type="range"
        min={0}
        max={max}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%", accentColor: color, cursor: "pointer",
          height: 4,
        }}
      />
    </div>
  );
}

function Divider() {
  return <div style={{ borderBottom: "1px solid var(--border)", margin: "14px 0" }} />;
}

function SectionLabel({ icon, children, accent }: { icon?: string; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, letterSpacing: "1.5px",
      color: accent ?? "var(--muted)",
      textTransform: "uppercase", marginBottom: 14,
      fontFamily: "var(--font-mono, monospace)",
      display: "flex", alignItems: "center", gap: 7,
    }}>
      {icon && <span>{icon}</span>}
      {children}
    </div>
  );
}

// ─── Payoff Ladder ────────────────────────────────────────────────────────────

function PayoffLadder({ levels, totalCost, lang }: {
  levels: LevelCalc[];
  totalCost: number;
  lang: Lang;
}) {
  const th = lang === "th";
  const maxAbsPnl = Math.max(1, ...levels.map((l) => Math.abs(l.pnlDollar)));

  return (
    <div style={card({ marginBottom: 0 })}>
      <SectionLabel icon="📊" accent="#8b5cf6">
        {th ? "Payoff Ladder — P&L ต่อระดับ" : "Payoff Ladder — P&L per Level"}
      </SectionLabel>

      {/* axis labels */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: 9, color: "var(--dim)", fontFamily: "var(--font-mono, monospace)",
        textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8,
      }}>
        <span>← {th ? "ขาดทุน" : "loss"}</span>
        <span style={{ color: "#8b5cf6" }}>| break-even |</span>
        <span>{th ? "กำไร" : "profit"} →</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {levels.map((l, i) => {
          const barPct = (Math.abs(l.pnlDollar) / maxAbsPnl) * 46; // max 46% of half
          const isRight = l.pnlDollar >= 0;
          const barColor = l.isStop
            ? "#ef4444"
            : l.pnlPct > 30 ? "#8b5cf6"
            : "#10b981";

          return (
            <div key={l.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* label */}
              <div style={{ width: 68, flexShrink: 0, textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: l.isStop ? "#ef4444" : "#10b981", fontFamily: "var(--font-mono, monospace)" }}>
                  {l.label}
                </div>
                <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>${fmt(l.exitPrice)}</div>
              </div>

              {/* track */}
              <div style={{ flex: 1, position: "relative", height: 28, background: "#09091a", borderRadius: 6, overflow: "hidden" }}>
                {/* center line (break-even) */}
                <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--border-bright)", zIndex: 2 }} />

                {/* bar */}
                <div
                  style={{
                    position: "absolute", top: 4, bottom: 4,
                    ...(isRight
                      ? { left: "50%", width: `${barPct}%` }
                      : { right: "50%", width: `${barPct}%` }),
                    background: isRight
                      ? `linear-gradient(90deg, ${barColor}55, ${barColor})`
                      : `linear-gradient(270deg, ${barColor}55, ${barColor})`,
                    borderRadius: 4,
                    transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)",
                  }}
                />

                {/* inline P&L label */}
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center",
                  justifyContent: isRight ? "flex-end" : "flex-start",
                  padding: "0 8px",
                  zIndex: 3,
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 800,
                    color: l.isProfit ? "#10b981" : "#ef4444",
                    fontFamily: "var(--font-mono, monospace)",
                    textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                  }}>
                    {fmtDollar(l.pnlDollar)} / {fmtPct(l.pnlPct)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* break-even note */}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 18, height: 1, background: "var(--border-bright)" }} />
        <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
          {th ? "เส้นกลาง = break-even = entry price" : "center line = break-even = entry price"}
        </span>
      </div>
    </div>
  );
}

// ─── Results Table ─────────────────────────────────────────────────────────────

function ResultsTable({ levels, portfolioSize, fxRate, lang }: {
  levels: LevelCalc[];
  portfolioSize: number | null;
  fxRate: number | null;
  lang: Lang;
}) {
  const th = lang === "th";
  const showPortfolio = portfolioSize && portfolioSize > 0;
  const showThb = fxRate && fxRate > 0;

  return (
    <div style={card({ padding: "20px 16px", marginTop: 12 })}>
      <SectionLabel icon="📋">
        {th ? "ตารางผลลัพธ์รายระดับ" : "Per-Level Results Table"}
      </SectionLabel>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Level", "Exit $", "Position Value", "P&L $", "P&L %",
                showPortfolio && "% Portfolio",
                showThb && "P&L ฿",
                "R/R (Tight)", "R/R (Hard)",
              ].filter(Boolean).map((h) => (
                <th key={h as string} style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, fontWeight: 800, letterSpacing: "1px", color: "var(--muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map((l, i) => {
              const pnlColor = l.isProfit ? "#10b981" : "#ef4444";
              const bg = i % 2 === 0 ? "transparent" : "#ffffff04";
              return (
                <tr key={l.key} style={{ background: bg, borderBottom: "1px solid var(--border)30" }}>
                  <td style={{ padding: "10px 10px", fontWeight: 800, color: l.isStop ? "#ef4444" : "#10b981" }}>{l.label}</td>
                  <td style={{ padding: "10px 10px", color: "var(--text)", fontWeight: 700 }}>${fmt(l.exitPrice)}</td>
                  <td style={{ padding: "10px 10px", color: "var(--text)" }}>${fmt(l.positionValue)}</td>
                  <td style={{ padding: "10px 10px", color: pnlColor, fontWeight: 800 }}>{fmtDollar(l.pnlDollar)}</td>
                  <td style={{ padding: "10px 10px", color: pnlColor, fontWeight: 800 }}>{fmtPct(l.pnlPct)}</td>
                  {showPortfolio && (
                    <td style={{ padding: "10px 10px", color: pnlColor }}>{l.pnlPortfolioPct !== null ? fmtPct(l.pnlPortfolioPct) : "—"}</td>
                  )}
                  {showThb && (
                    <td style={{ padding: "10px 10px", color: pnlColor, whiteSpace: "nowrap" }}>
                      {l.pnlThb !== null ? `${l.pnlThb >= 0 ? "+" : ""}฿${fmt(Math.abs(l.pnlThb), 0)}` : "—"}
                    </td>
                  )}
                  <td style={{ padding: "10px 10px" }}>
                    {l.rrTight !== null ? (
                      <span style={{ color: rrColor(l.rrTight), fontWeight: 700 }}>{rrBadge(l.rrTight)}</span>
                    ) : <span style={{ color: "var(--dim)" }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 10px" }}>
                    {l.rrHard !== null ? (
                      <span style={{ color: rrColor(l.rrHard), fontWeight: 700 }}>{rrBadge(l.rrHard)}</span>
                    ) : <span style={{ color: "var(--dim)" }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono, monospace)" }}>
          ✓ R/R ≥ 3:1 = strong · ⚠ R/R &lt; 2:1 = weak
        </span>
      </div>
    </div>
  );
}

// ─── Max Loss / Max Gain summary ───────────────────────────────────────────────

function MaxLossGain({ levels, lang }: { levels: LevelCalc[]; lang: Lang }) {
  const th = lang === "th";
  const stops = levels.filter((l) => l.isStop);
  const tps = levels.filter((l) => !l.isStop);
  const worstLoss = stops.reduce((w, l) => l.pnlDollar < w.pnlDollar ? l : w, stops[0]);
  const bestGain = tps.reduce((b, l) => l.pnlDollar > b.pnlDollar ? l : b, tps[0]);
  if (!worstLoss || !bestGain) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, #ef444410 0%, #09091a 40%, #10b98110 100%)",
      border: "1px solid var(--border)",
      borderRadius: 12, padding: "16px 20px", marginTop: 12,
    }}>
      <SectionLabel icon="⚖️">{th ? "สรุป Max Risk vs Max Reward" : "Max Loss vs Max Gain"}</SectionLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#ef4444", fontFamily: "var(--font-mono, monospace)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "1px" }}>
            {th ? "ขาดทุนสูงสุด" : "Max Risk"} ({worstLoss.label})
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#ef4444", fontFamily: "var(--font-mono, monospace)", letterSpacing: "-1px" }}>
            {fmtDollar(worstLoss.pnlDollar)}
          </div>
          <div style={{ fontSize: 11, color: "#ef444499", fontFamily: "var(--font-mono, monospace)" }}>
            {fmtPct(worstLoss.pnlPct)}
          </div>
        </div>

        <div style={{ flex: 1, textAlign: "center", fontSize: 20, color: "var(--border-bright)" }}>↔</div>

        <div style={{ flex: 2, textAlign: "center", padding: "10px 16px", background: "#ffffff07", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginBottom: 4 }}>
            {th ? "กำลังเสี่ยง" : "Risking"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", fontFamily: "var(--font-mono, monospace)" }}>
            <span style={{ color: "#ef4444" }}>${fmt(Math.abs(worstLoss.pnlDollar))}</span>
            <span style={{ color: "var(--muted)", margin: "0 8px" }}>{th ? "เพื่อทำกำไร" : "to make up to"}</span>
            <span style={{ color: "#10b981" }}>${fmt(bestGain.pnlDollar)}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginTop: 3 }}>
            {th ? `บน ${bestGain.label}` : `at ${bestGain.label}`} · implied R/R {fmt(bestGain.pnlDollar / Math.abs(worstLoss.pnlDollar), 1)}:1
          </div>
        </div>

        <div style={{ flex: 1, textAlign: "center" }}>↔</div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#10b981", fontFamily: "var(--font-mono, monospace)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "1px" }}>
            {th ? "กำไรสูงสุด" : "Max Reward"} ({bestGain.label})
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#10b981", fontFamily: "var(--font-mono, monospace)", letterSpacing: "-1px" }}>
            {fmtDollar(bestGain.pnlDollar)}
          </div>
          <div style={{ fontSize: 11, color: "#10b98199", fontFamily: "var(--font-mono, monospace)" }}>
            {fmtPct(bestGain.pnlPct)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Scale-out result block ────────────────────────────────────────────────────

function ScaleOutBlock({ result, lang }: { result: ScaleOutResult; lang: Lang }) {
  const th = lang === "th";
  const color = result.blendedPnlDollar >= 0 ? "#10b981" : "#ef4444";

  return (
    <div style={{
      border: "1px solid #8b5cf640",
      background: "linear-gradient(135deg, #8b5cf608 0%, #09091a 60%)",
      borderRadius: 12, padding: "16px 20px",
    }}>
      <SectionLabel icon="📐" accent="#8b5cf6">
        {th ? "Blended Scale-Out — กำไรรวมแบบ staged exit" : "Blended Scale-Out — Staged Exit Profit"}
      </SectionLabel>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        {result.breakdown.map((b) => (
          <div key={b.label} style={{ textAlign: "center", background: "#ffffff07", borderRadius: 8, padding: "8px 14px" }}>
            <div style={{ fontSize: 9, color: "#8b5cf6", fontFamily: "var(--font-mono, monospace)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 3 }}>
              {b.label} · {b.pct}%
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: b.pnlDollar >= 0 ? "#10b981" : "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>
              {fmtDollar(b.pnlDollar)}
            </div>
          </div>
        ))}
        {result.remainingPct > 0 && (
          <div style={{ textAlign: "center", background: "#ffffff05", borderRadius: 8, padding: "8px 14px", border: "1px dashed var(--border-bright)" }}>
            <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 3 }}>
              {th ? "ถือต่อ" : "Remaining"} · {result.remainingPct}%
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
              {th ? "ยังไม่ขาย" : "unrealized"}
            </div>
          </div>
        )}
      </div>
      <div style={{ borderTop: "1px dashed #8b5cf640", paddingTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
            {th ? "กำไรรวม (realized)" : "Total Realized Profit"}
          </span>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 22, fontWeight: 900, color, fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.5px" }}>
              {fmtDollar(result.blendedPnlDollar)}
            </span>
            <span style={{ fontSize: 13, color, fontFamily: "var(--font-mono, monospace)", marginLeft: 10 }}>
              {fmtPct(result.blendedPnlPct)}
            </span>
          </div>
        </div>
        {result.blendedPnlThb !== null && (
          <div style={{ textAlign: "right", fontSize: 12, color: `${color}aa`, fontFamily: "var(--font-mono, monospace)", marginTop: 3 }}>
            {result.blendedPnlThb >= 0 ? "+" : ""}฿{fmt(Math.abs(result.blendedPnlThb), 0)} THB
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EV block ─────────────────────────────────────────────────────────────────

function EVBlock({ ev, lang }: { ev: EV; lang: Lang }) {
  const th = lang === "th";
  const color = ev.dollar >= 0 ? "#10b981" : "#ef4444";

  return (
    <div style={{
      border: "1px solid #8b5cf640",
      background: "linear-gradient(135deg, #8b5cf608 0%, #09091a 60%)",
      borderRadius: 12, padding: "16px 20px", marginTop: 10,
    }}>
      <SectionLabel icon="🎲" accent="#8b5cf6">
        {th ? "Probability-Weighted EV — คาดหวังตามความน่าจะเป็น" : "Expected Value — Probability-Weighted Outcome"}
      </SectionLabel>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {ev.breakdown.map((b) => {
          const bColor = b.pnlDollar >= 0 ? "#10b981" : "#ef4444";
          return (
            <div key={b.label} style={{ textAlign: "center", background: "#ffffff07", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 9, color: "#8b5cf6", fontFamily: "var(--font-mono, monospace)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 2 }}>
                {b.label}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginBottom: 3 }}>
                p = {b.prob}%
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: bColor, fontFamily: "var(--font-mono, monospace)" }}>
                {fmtDollar(b.pnlDollar)}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ borderTop: "1px dashed #8b5cf640", paddingTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
            {th ? "Expected Value (คาดหวัง)" : "Expected Value"}
          </span>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 22, fontWeight: 900, color, fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.5px" }}>
              {fmtDollar(ev.dollar)}
            </span>
            <span style={{ fontSize: 13, color, fontFamily: "var(--font-mono, monospace)", marginLeft: 10 }}>
              {fmtPct(ev.pct)}
            </span>
          </div>
        </div>
        {ev.thb !== null && (
          <div style={{ textAlign: "right", fontSize: 12, color: `${color}aa`, fontFamily: "var(--font-mono, monospace)", marginTop: 3 }}>
            {ev.thb >= 0 ? "+" : ""}฿{fmt(Math.abs(ev.thb), 0)} THB (expected)
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function SimulatorContent({ report }: { report: StockReport }) {
  const [lang, setLang] = useState<Lang>("en");
  const th = lang === "th";

  // ── Pre-fill from report ──────────────────────────────────────────────────
  const preferredEntry = report.entryStrategy.entryLevels.find((e) => e.preferred) ?? report.entryStrategy.entryLevels[0];
  const defaultEntry = preferredEntry?.level ?? report.price;

  const sl = report.entryStrategy.stopLoss;
  const defaultTight = sl.tight ?? report.price * 0.9;
  const defaultHard = sl.hard ?? report.price * 0.8;

  // ── Input state ───────────────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<InputMode>("amount");
  const [amountStr, setAmountStr] = useState("5000");
  const [sharesStr, setSharesStr] = useState("");
  const [entryStr, setEntryStr] = useState(String(defaultEntry));
  const [portfolioStr, setPortfolioStr] = useState("");
  const [fxStr, setFxStr] = useState(""); // THB per USD

  // TP/SL editable fields
  const [tp1Str, setTp1Str] = useState(String(report.entryStrategy.tp1.price));
  const [tp2Str, setTp2Str] = useState(String(report.entryStrategy.tp2.price));
  const [tp3Str, setTp3Str] = useState(String(report.entryStrategy.tp3.price));
  const [tightStr, setTightStr] = useState(String(defaultTight));
  const [hardStr, setHardStr] = useState(String(defaultHard));

  // DCA mode
  const [dcaMode, setDcaMode] = useState(false);
  const entryLevels = report.entryStrategy.entryLevels;
  const [dcaRows, setDcaRows] = useState<DcaRow[]>(
    entryLevels.map((e) => ({ price: e.level, sharesAmt: 0 }))
  );

  // Scale-out (% to sell at each TP)
  const [scaleOut, setScaleOut] = useState<ScaleOut>({ tp1: 100, tp2: 0, tp3: 0 });

  // Scenario probabilities (from report scenarios)
  const scenarioKeys = ["bear", "base", "bull", "moon"] as const;
  const scenarioData = (() => {
    const s = report.scenarios ?? [];
    const map: Record<string, number> = {};
    s.forEach((sc) => {
      map[sc.label.toLowerCase()] = sc.pct;
    });
    return scenarioKeys.map((k) => ({
      label: k.charAt(0).toUpperCase() + k.slice(1),
      pct: map[k] ?? (k === "bear" ? -20 : k === "base" ? 10 : k === "bull" ? 25 : 45),
    }));
  })();

  const defaultProbs = [25, 35, 30, 10];
  const [probs, setProbs] = useState<number[]>(defaultProbs);

  // ── Derived values ────────────────────────────────────────────────────────
  const entryPrice = parseFloat(entryStr) || defaultEntry;
  const tp1 = parseFloat(tp1Str) || report.entryStrategy.tp1.price;
  const tp2 = parseFloat(tp2Str) || report.entryStrategy.tp2.price;
  const tp3 = parseFloat(tp3Str) || report.entryStrategy.tp3.price;
  const tightStop = parseFloat(tightStr) || defaultTight;
  const hardStop = parseFloat(hardStr) || defaultHard;
  const portfolioSize = parseFloat(portfolioStr) || null;
  const fxRate = parseFloat(fxStr) || null;

  // Effective entry / shares / cost (DCA or simple)
  const { effectiveEntry, effectiveShares, effectiveCost } = (() => {
    if (dcaMode) {
      const { blendedPrice, totalShares, totalCost } = calcDcaBlend(dcaRows);
      return { effectiveEntry: blendedPrice, effectiveShares: totalShares, effectiveCost: totalCost };
    }
    if (inputMode === "amount") {
      const amt = parseFloat(amountStr) || 0;
      const sh = entryPrice > 0 ? amt / entryPrice : 0;
      return { effectiveEntry: entryPrice, effectiveShares: sh, effectiveCost: amt };
    } else {
      const sh = parseFloat(sharesStr) || 0;
      const amt = sh * entryPrice;
      return { effectiveEntry: entryPrice, effectiveShares: sh, effectiveCost: amt };
    }
  })();

  // Sync derived field display
  const derivedAmount = effectiveShares * effectiveEntry;
  const derivedShares = effectiveCost / effectiveEntry;

  // ── Compute results ───────────────────────────────────────────────────────
  const levels = calcLevels(
    effectiveShares, effectiveCost, effectiveEntry,
    tp1, tp2, tp3, tightStop, hardStop,
    portfolioSize, fxRate
  );

  const scaleOutResult = calcScaleOut(
    effectiveShares, effectiveCost, effectiveEntry,
    tp1, tp2, tp3, scaleOut, fxRate
  );

  const probTotal = probs.reduce((a, b) => a + b, 0);
  const evResult = calcEV(
    effectiveShares, effectiveCost, effectiveEntry,
    scenarioData, probs, fxRate
  );

  // ── Validation warnings ────────────────────────────────────────────────────
  const warnings: string[] = [];
  if (tp1 <= effectiveEntry) warnings.push(th ? "TP1 ต้องมากกว่า Entry" : "TP1 must be above entry");
  if (tp2 <= tp1) warnings.push(th ? "TP2 ต้องมากกว่า TP1" : "TP2 must be above TP1");
  if (tp3 <= tp2) warnings.push(th ? "TP3 ต้องมากกว่า TP2" : "TP3 must be above TP2");
  if (tightStop >= effectiveEntry) warnings.push(th ? "Tight Stop ต้องน้อยกว่า Entry" : "Tight Stop must be below entry");
  if (hardStop >= tightStop) warnings.push(th ? "Hard Stop ต้องน้อยกว่า Tight Stop" : "Hard Stop must be below tight stop");
  if (probTotal !== 100) warnings.push(th ? `ความน่าจะเป็นรวม ${probTotal}% (ต้องรวม 100%)` : `Probabilities sum to ${probTotal}% (must equal 100%)`);
  const scaleTotal = scaleOut.tp1 + scaleOut.tp2 + scaleOut.tp3;
  if (scaleTotal > 100) warnings.push(th ? "Scale-out รวมเกิน 100%" : "Scale-out allocation exceeds 100%");

  // ── Sticky header ──────────────────────────────────────────────────────────
  const [showSticky, setShowSticky] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 180);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* ── Sticky bar ── */}
      {showSticky && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 60,
          background: "rgba(8,8,14,0.88)",
          borderBottom: "1px solid var(--border-bright)",
          backdropFilter: "blur(16px)",
          animation: "slideDownBar 0.25s cubic-bezier(0.22,1,0.36,1) both",
        }}>
          <div style={{ height: 2, background: "linear-gradient(90deg, #8b5cf6, #10b981)" }} />
          <div style={{
            maxWidth: 1200, margin: "0 auto", padding: "8px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 900, fontFamily: "var(--font-display, sans-serif)" }}>
                {report.ticker}
              </span>
              <span style={{ fontSize: 10, color: "#8b5cf6", fontFamily: "var(--font-mono, monospace)", fontWeight: 800, letterSpacing: "1px" }}>
                POSITION SIMULATOR
              </span>
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              {[
                { label: "Entry", val: `$${fmt(effectiveEntry)}` },
                { label: "Shares", val: fmtShares(effectiveShares) },
                { label: "Total Cost", val: `$${fmt(effectiveCost)}` },
                { label: "Break-even", val: `$${fmt(effectiveEntry)}` },
              ].map(({ label, val }) => (
                <div key={label} style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 8, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", textTransform: "uppercase", letterSpacing: "1px" }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", fontFamily: "var(--font-mono, monospace)" }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Nav ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <Link href={`/report/${report.ticker.toLowerCase()}`} style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>
          ← {report.ticker} Report
        </Link>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 3, background: "#1a1a2e", borderRadius: 8, padding: 3 }}>
            {(["en", "th"] as Lang[]).map((l) => (
              <button key={l} onClick={() => setLang(l)} style={{
                fontSize: 11, fontWeight: 800, padding: "4px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                background: lang === l ? "#3b82f6" : "transparent",
                color: lang === l ? "#fff" : "var(--muted)",
                transition: "background 0.15s, color 0.15s",
                textTransform: "uppercase", letterSpacing: "1px",
                fontFamily: "var(--font-mono, monospace)",
              }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Page hero ── */}
      <div style={{
        background: "linear-gradient(120deg, #8b5cf612 0%, #8b5cf604 30%, var(--card) 60%)",
        border: "1px solid var(--border)",
        borderTop: "2px solid #8b5cf6",
        borderRadius: 16, padding: "22px 26px", marginBottom: 20,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 50% 100% at 0% 50%, #8b5cf610 0%, transparent 60%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "2px", color: "#8b5cf6", textTransform: "uppercase", fontFamily: "var(--font-mono, monospace)", marginBottom: 8 }}>
              📐 Position Simulator
            </div>
            <h1 style={{ fontSize: "clamp(22px, 4vw, 36px)", fontWeight: 900, margin: 0, fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.5px", lineHeight: 1 }}>
              {report.ticker} <span style={{ color: "#8b5cf6" }}>Position Calculator</span>
            </h1>
            <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginTop: 6 }}>
              {report.companyName} · {th ? "คำนวณ P&L, R/R, Scale-out และ EV แบบ real-time" : "Live P&L · R/R · Scale-out · Expected Value"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: th ? "ราคาปัจจุบัน" : "Current Price", val: `$${fmt(report.price)}`, color: "var(--text)" },
              { label: "Entry (pre-fill)", val: `$${fmt(defaultEntry)}`, color: "#3b82f6" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", textTransform: "uppercase", letterSpacing: "1px" }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: "var(--font-mono, monospace)" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Position summary bar */}
        <div style={{
          marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)",
          display: "flex", gap: 20, flexWrap: "wrap",
        }}>
          {[
            { label: th ? "Entry" : "Entry Price", val: `$${fmt(effectiveEntry)}`, color: "#3b82f6" },
            { label: th ? "จำนวนหุ้น" : "Shares", val: fmtShares(effectiveShares), color: "var(--text)" },
            { label: th ? "ต้นทุนรวม" : "Total Cost", val: `$${fmt(effectiveCost)}`, color: "var(--text)" },
            { label: th ? "Break-even" : "Break-even", val: `$${fmt(effectiveEntry)}`, color: "#f59e0b" },
          ].map(({ label, val, color }) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "var(--font-mono, monospace)" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{ background: "#f59e0b12", border: "1px solid #f59e0b40", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
          {warnings.map((w) => (
            <div key={w} style={{ fontSize: 12, color: "#f59e0b", fontFamily: "var(--font-mono, monospace)", marginBottom: 3 }}>
              ⚠ {w}
            </div>
          ))}
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 380px) 1fr", gap: 16, alignItems: "start" }}>

        {/* ── LEFT: Input panel ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Investment sizing */}
          <div style={card()}>
            <SectionLabel icon="💰">{th ? "ขนาดการลงทุน" : "Investment Sizing"}</SectionLabel>

            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 3, background: "#09091a", borderRadius: 8, padding: 3, marginBottom: 14 }}>
              {([["amount", th ? "ตามจำนวนเงิน" : "By Amount ($)"], ["shares", th ? "ตามจำนวนหุ้น" : "By Shares"]] as [InputMode, string][]).map(([m, label]) => (
                <button key={m} onClick={() => setInputMode(m)} style={{
                  flex: 1, fontSize: 11, fontWeight: 800, padding: "6px 10px", borderRadius: 6, border: "none",
                  cursor: "pointer",
                  background: inputMode === m ? "#8b5cf6" : "transparent",
                  color: inputMode === m ? "#fff" : "var(--muted)",
                  transition: "all 0.15s",
                  fontFamily: "var(--font-mono, monospace)",
                }}>{label}</button>
              ))}
            </div>

            {inputMode === "amount" ? (
              <div>
                <Label>{th ? "จำนวนเงิน (USD)" : "Investment Amount (USD)"}</Label>
                <InputField value={amountStr} onChange={setAmountStr} prefix="$" placeholder="5000" />
                <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginTop: 8 }}>
                  → {th ? "จำนวนหุ้น" : "Shares"}: <span style={{ color: "var(--text)", fontWeight: 700 }}>{fmtShares(effectiveShares)}</span>
                  {effectiveShares < 1 && <span style={{ color: "#f59e0b", marginLeft: 8 }}>({th ? "หุ้นส่วน" : "fractional ok"})</span>}
                </div>
              </div>
            ) : (
              <div>
                <Label>{th ? "จำนวนหุ้น" : "Number of Shares"}</Label>
                <InputField value={sharesStr} onChange={setSharesStr} prefix="×" placeholder="12" />
                <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginTop: 8 }}>
                  → {th ? "ต้นทุนรวม" : "Total Cost"}: <span style={{ color: "var(--text)", fontWeight: 700 }}>${fmt(effectiveCost)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Entry price */}
          <div style={card()}>
            <SectionLabel icon="🎯">{th ? "ราคา Entry" : "Entry Price"}</SectionLabel>
            <InputField value={entryStr} onChange={setEntryStr} prefix="$" placeholder={String(defaultEntry)} />
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => setDcaMode(!dcaMode)}
                style={{
                  fontSize: 11, fontWeight: 800, padding: "5px 12px", borderRadius: 6,
                  background: dcaMode ? "#3b82f620" : "transparent",
                  color: dcaMode ? "#3b82f6" : "var(--muted)",
                  border: `1px solid ${dcaMode ? "#3b82f640" : "var(--border)"}`,
                  cursor: "pointer", fontFamily: "var(--font-mono, monospace)",
                  transition: "all 0.15s",
                }}
              >
                {th ? "⚖ คำนวณ DCA Blended Entry" : "⚖ DCA Blended Entry Helper"}
              </button>
            </div>

            {dcaMode && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "1px" }}>
                  {th ? "ป้อนจำนวนหุ้นที่ซื้อในแต่ละ level:" : "Enter shares purchased at each level:"}
                </div>
                {entryLevels.map((e, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 90, flexShrink: 0 }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{e.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#3b82f6", fontFamily: "var(--font-mono, monospace)" }}>${e.level}</div>
                    </div>
                    <InputField
                      value={dcaRows[i]?.sharesAmt === 0 ? "" : String(dcaRows[i]?.sharesAmt ?? "")}
                      onChange={(v) => {
                        const updated = [...dcaRows];
                        updated[i] = { price: e.level, sharesAmt: parseFloat(v) || 0 };
                        setDcaRows(updated);
                      }}
                      prefix="×"
                      placeholder="0"
                    />
                  </div>
                ))}
                {effectiveShares > 0 && (
                  <div style={{
                    marginTop: 10, padding: "10px 14px", background: "#3b82f610", border: "1px solid #3b82f630", borderRadius: 8,
                    fontSize: 12, fontFamily: "var(--font-mono, monospace)",
                  }}>
                    <div style={{ color: "var(--muted)", marginBottom: 4 }}>{th ? "Blended Entry:" : "Blended Entry:"}</div>
                    <div style={{ color: "#3b82f6", fontWeight: 800, fontSize: 16 }}>${fmt(effectiveEntry)}</div>
                    <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 3 }}>
                      {fmtShares(effectiveShares)} {th ? "หุ้น · ต้นทุน" : "shares · cost"} ${fmt(effectiveCost)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* TP / SL editable */}
          <div style={card()}>
            <SectionLabel icon="📍">{th ? "ระดับเป้าหมายและ Stop" : "Target & Stop Levels"}</SectionLabel>
            {[
              { label: "TP1", str: tp1Str, set: setTp1Str, color: "#10b981" },
              { label: "TP2", str: tp2Str, set: setTp2Str, color: "#10b981" },
              { label: "TP3 🌙", str: tp3Str, set: setTp3Str, color: "#8b5cf6" },
              { label: "Tight Stop", str: tightStr, set: setTightStr, color: "#f59e0b" },
              { label: "Hard Stop", str: hardStr, set: setHardStr, color: "#ef4444" },
            ].map(({ label, str, set, color }) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Label>{label}</Label>
                  <span style={{ fontSize: 10, color, fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>
                    {parseFloat(str) > 0 && effectiveEntry > 0
                      ? fmtPct(((parseFloat(str) - effectiveEntry) / effectiveEntry) * 100)
                      : ""}
                  </span>
                </div>
                <InputField value={str} onChange={set} prefix="$" />
              </div>
            ))}
          </div>

          {/* Portfolio size + FX */}
          <div style={card()}>
            <SectionLabel icon="🌐">{th ? "ตัวเลือกเพิ่มเติม" : "Optional Settings"}</SectionLabel>
            <Label muted>{th ? "ขนาดพอร์ต (USD) — เพื่อแสดง % พอร์ต" : "Portfolio Size (USD) — for % of portfolio"}</Label>
            <InputField value={portfolioStr} onChange={setPortfolioStr} prefix="$" placeholder="50000" />
            <div style={{ marginTop: 12 }}>
              <Label muted>{th ? "อัตราแลกเปลี่ยน (THB/USD) — สำหรับแสดง P&L เป็นบาท" : "FX Rate (THB/USD) — show P&L in THB"}</Label>
              <InputField value={fxStr} onChange={setFxStr} prefix="฿" suffix="/ $1" placeholder="35.0" />
            </div>
          </div>

          {/* Scale-out planner */}
          <div style={card()}>
            <SectionLabel icon="📤" accent="#8b5cf6">{th ? "Scale-out Planner — ขายกี่ % ต่อ TP" : "Scale-out Planner — % to Sell per TP"}</SectionLabel>
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginBottom: 14, lineHeight: 1.6 }}>
              {th ? "กำหนด % ที่ขายใน TP แต่ละระดับ (รวมต้องไม่เกิน 100%)" : "Allocate what % of position to sell at each TP (max 100% total)"}
            </div>
            {[
              { key: "tp1" as const, label: "TP1", color: "#10b981" },
              { key: "tp2" as const, label: "TP2", color: "#10b981" },
              { key: "tp3" as const, label: "TP3 🌙", color: "#8b5cf6" },
            ].map(({ key, label, color }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Label>{label}</Label>
                  <span style={{ fontSize: 14, fontWeight: 900, color, fontFamily: "var(--font-mono, monospace)" }}>{scaleOut[key]}%</span>
                </div>
                <Slider
                  value={scaleOut[key]}
                  onChange={(v) => setScaleOut((s) => ({ ...s, [key]: v }))}
                  color={color}
                />
              </div>
            ))}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              paddingTop: 10, borderTop: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                {th ? "รวมขาย" : "Total sold"}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: scaleTotal > 100 ? "#ef4444" : scaleTotal === 100 ? "#10b981" : "#f59e0b" }}>
                {scaleTotal}%
              </span>
            </div>
          </div>

          {/* Scenario probabilities */}
          <div style={card()}>
            <SectionLabel icon="🎲" accent="#8b5cf6">{th ? "Scenario Probability — ความน่าจะเป็น" : "Scenario Probabilities"}</SectionLabel>
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginBottom: 14, lineHeight: 1.6 }}>
              {th ? "ปรับความน่าจะเป็นให้รวม 100% เพื่อคำนวณ Expected Value" : "Adjust to sum to 100% — used to compute probability-weighted EV"}
            </div>
            {scenarioData.map((s, i) => {
              const colors = ["#ef4444", "#f59e0b", "#10b981", "#8b5cf6"];
              const color = colors[i] ?? "#64748b";
              return (
                <div key={s.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "var(--font-mono, monospace)" }}>{s.label}</span>
                      <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginLeft: 8 }}>
                        {s.pct >= 0 ? "+" : ""}{s.pct}%
                      </span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 900, color, fontFamily: "var(--font-mono, monospace)" }}>{probs[i]}%</span>
                  </div>
                  <Slider
                    value={probs[i]}
                    onChange={(v) => setProbs((p) => { const n = [...p]; n[i] = v; return n; })}
                    color={color}
                  />
                </div>
              );
            })}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              paddingTop: 10, borderTop: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                {th ? "รวม" : "Total"}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: probTotal !== 100 ? "#ef4444" : "#10b981" }}>
                {probTotal}%
              </span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Results ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Payoff Ladder */}
          <PayoffLadder levels={levels} totalCost={effectiveCost} lang={lang} />

          {/* Max loss/gain headline */}
          <MaxLossGain levels={levels} lang={lang} />

          {/* Results table */}
          <ResultsTable levels={levels} portfolioSize={portfolioSize} fxRate={fxRate} lang={lang} />

          {/* Synthesis block — purple, visually separated */}
          <div style={{
            border: "1px solid #8b5cf640",
            borderRadius: 14, padding: "20px",
            background: "linear-gradient(160deg, #8b5cf60a 0%, #09091a 50%, #8b5cf606 100%)",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse 70% 30% at 50% -10%, #8b5cf618 0%, transparent 60%)",
              pointerEvents: "none",
            }} />
            <div style={{ position: "relative" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
                paddingBottom: 12, borderBottom: "1px solid #8b5cf630",
              }}>
                <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #8b5cf655)" }} />
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase",
                  fontFamily: "var(--font-mono, monospace)", color: "#c4b5fd",
                  padding: "4px 14px", borderRadius: 20,
                  background: "#8b5cf614", border: "1px solid #8b5cf640",
                }}>
                  🧠 {th ? "ชั้นวิเคราะห์สังเคราะห์" : "Synthesis Layer"}
                </span>
                <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #8b5cf655, transparent)" }} />
              </div>

              <ScaleOutBlock result={scaleOutResult} lang={lang} />
              <EVBlock ev={evResult} lang={lang} />
            </div>
          </div>

          {/* Footer note */}
          <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", padding: "8px 0", fontFamily: "var(--font-mono, monospace)" }}>
            {th
              ? "เครื่องคิดเลขนี้เป็นเพียงเครื่องมือวางแผน — ไม่ใช่คำแนะนำทางการเงิน"
              : "This calculator is a planning tool only · Not financial advice"}
          </div>
        </div>
      </div>

      {/* Mobile: stack single column */}
      <style>{`
        @media (max-width: 760px) {
          div[style*="grid-template-columns: minmax(300px, 380px)"] {
            grid-template-columns: 1fr !important;
          }
        }
        input[type=range] {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 4px;
          background: var(--border-bright);
          outline: none;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: currentColor;
          cursor: pointer;
        }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}
