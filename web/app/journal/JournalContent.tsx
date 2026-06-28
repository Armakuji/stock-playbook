"use client";

import { useState, useCallback, useEffect } from "react";
import type { LivePrice } from "@/app/api/prices/route";
import Link from "next/link";
import { Trade, CatalystType, TradeExit } from "@/lib/journal-types";
import { JournalStats, realizedPnL as calcPnL, holdDays } from "@/lib/journal-math";

// Passed from server page — slim subset of StockReport
export interface ReportOption {
  ticker:       string;
  companyName:  string;
  price:        number;
  tp1:          number;
  tp2:          number;
  tp3:          number;
  tightStop:    number | null;
  reportDate:   string; // YYYYMMDD
  catalystType: string | null;
}

export interface PriceInfo {
  price:       number;
  generatedAt: string; // ISO string
  companyName: string;
  isLive?:     boolean;  // true = fetched from Yahoo Finance this session
  changePct?:  number;
  marketState?: string;
}

// ── Position state ─────────────────────────────────────────────────────────────

type PositionState =
  | "STOP_LOSS"
  | "AT_RISK"
  | "IN_PROGRESS"
  | "TP1_HIT"
  | "TP2_HIT"
  | "TP3_HIT"
  | "UNKNOWN";

function getPositionState(trade: Trade, currentPrice: number | null): PositionState {
  if (currentPrice === null || trade.status === "closed") return "UNKNOWN";
  const { plannedSL, plannedTP, entryPrice } = trade;
  const [tp1, tp2, tp3] = plannedTP;
  if (tp3 > 0 && currentPrice >= tp3) return "TP3_HIT";
  if (tp2 > 0 && currentPrice >= tp2) return "TP2_HIT";
  if (tp1 > 0 && currentPrice >= tp1) return "TP1_HIT";
  if (plannedSL > 0 && currentPrice <= plannedSL) return "STOP_LOSS";
  // AT_RISK = within 3% above SL
  if (plannedSL > 0 && entryPrice > 0 && currentPrice <= plannedSL * 1.03) return "AT_RISK";
  return "IN_PROGRESS";
}

const STATE_META: Record<PositionState, { label: string; color: string; bg: string; icon: string }> = {
  STOP_LOSS:   { label: "STOP LOSS", color: "#ef4444", bg: "#ef444418", icon: "🚨" },
  AT_RISK:     { label: "AT RISK",   color: "#f59e0b", bg: "#f59e0b15", icon: "⚠️" },
  IN_PROGRESS: { label: "OPEN",      color: "#3b82f6", bg: "#3b82f615", icon: "🔵" },
  TP1_HIT:     { label: "TP1 HIT",  color: "#10b981", bg: "#10b98115", icon: "🟢" },
  TP2_HIT:     { label: "TP2 HIT",  color: "#10b981", bg: "#10b98120", icon: "🟢" },
  TP3_HIT:     { label: "TP3 🌙",   color: "#8b5cf6", bg: "#8b5cf618", icon: "🌙" },
  UNKNOWN:     { label: "",          color: "var(--muted)", bg: "transparent", icon: "" },
};

function priceStaleness(info: PriceInfo): { label: string; color: string } {
  if (info.isLive) {
    const state = info.marketState ?? "REGULAR";
    const stateLabel = state === "REGULAR" ? "market open" : state === "PRE" ? "pre-market" : state === "POST" ? "after hours" : "delayed";
    return { label: `LIVE · ${stateLabel}`, color: "#10b981" };
  }
  const diffMs   = Date.now() - new Date(info.generatedAt).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const d        = new Date(info.generatedAt);
  const dateStr  = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (diffDays < 1)  return { label: `from report · today · ${dateStr}`,        color: "#10b981" };
  if (diffDays < 2)  return { label: `from report · 1 day ago · ${dateStr}`,    color: "#10b981" };
  if (diffDays < 4)  return { label: `from report · ${Math.floor(diffDays)}d ago · ${dateStr}`, color: "#f59e0b" };
  return              { label: `from report · ${Math.floor(diffDays)}d ago · ${dateStr} ⚠️`,     color: "#ef4444" };
}

function todayYYYYMMDD(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATALYST_TYPES: CatalystType[] = [
  "earnings_beat","satellite_launch","fda_decision","foundry_validation",
  "delivery_beat","partnership_win","product_launch","regulatory_approval",
  "phase3_readout","design_win","macro","other",
];

const VERDICT_COLORS: Record<string, string> = {
  BUY: "#10b981", HOLD: "#f59e0b", SELL: "#ef4444", SPECULATIVE: "#8b5cf6",
};

function pnlColor(v: number): string {
  return v > 0 ? "#10b981" : v < 0 ? "#ef4444" : "#64748b";
}

function fmt$(v: number): string {
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? "-" : "+") + "$" + abs;
}

function fmtPct(v: number): string {
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiSave(trade: Trade) {
  await fetch("/journal/api", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "save", trade }),
  });
}

async function apiDelete(id: string) {
  await fetch("/journal/api", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: "var(--card-elevated, #0f172a)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: color ?? "var(--text)", fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, fontFamily: "var(--font-mono, monospace)" }}>{sub}</div>}
    </div>
  );
}

function WinBar({ rate }: { rate: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${rate * 100}%`, background: "#10b981", borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: "#10b981", fontFamily: "var(--font-mono, monospace)", minWidth: 36 }}>{(rate * 100).toFixed(0)}%</span>
    </div>
  );
}

// ── Trade Form ────────────────────────────────────────────────────────────────

function emptyTrade(): Omit<Trade, "id"> {
  return {
    ticker: "", catalystType: "earnings_beat",
    entryPrice: 0, shares: 0, entryDate: new Date().toISOString().slice(0, 10),
    plannedTP: [0, 0, 0], plannedSL: 0,
    status: "open", exits: [], notes: "",
    linkedReportDate: todayYYYYMMDD(),
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg, #0f172a)", border: "1px solid var(--border)",
  borderRadius: 6, padding: "7px 10px", color: "var(--text)",
  fontFamily: "var(--font-mono, monospace)", fontSize: 13,
  outline: "none", width: "100%",
};

function TradeForm({ initial, reportOptions, reportsByTicker, onSave, onCancel }: {
  initial?: Trade;
  reportOptions: ReportOption[];
  reportsByTicker: Record<string, ReportDateOption[]>;
  onSave: (t: Trade) => void;
  onCancel: () => void;
}) {
  const [t, setT] = useState<Trade>(initial ?? { id: newId(), ...emptyTrade() });
  const [customTicker, setCustomTicker] = useState(
    initial ? !reportOptions.some((r) => r.ticker === initial.ticker) : false
  );

  function field<K extends keyof Trade>(k: K, v: Trade[K]) {
    setT((prev) => ({ ...prev, [k]: v }));
  }

  function setTP(idx: number, v: number) {
    const arr = [...t.plannedTP];
    arr[idx] = v;
    setT((prev) => ({ ...prev, plannedTP: arr }));
  }

  function fillFromReportDate(ticker: string, reportDate: string) {
    const dates = reportsByTicker[ticker] ?? [];
    const r = dates.find((d) => d.reportDate === reportDate) ?? dates[0];
    if (!r) return;
    setT((prev) => ({
      ...prev,
      ticker,
      entryPrice:       r.price,
      plannedTP:        [r.tp1, r.tp2, r.tp3],
      plannedSL:        r.tightStop ?? prev.plannedSL,
      linkedReportDate: r.reportDate,
      catalystType:     (r.catalystType as CatalystType) ?? prev.catalystType,
    }));
  }

  function handleTickerSelect(ticker: string) {
    if (ticker === "__other__") {
      setCustomTicker(true);
      field("ticker", "");
      return;
    }
    setCustomTicker(false);
    const dates = reportsByTicker[ticker];
    if (dates && dates.length > 0) {
      fillFromReportDate(ticker, dates[0].reportDate); // latest
    } else {
      // fallback to reportOptions
      const r = reportOptions.find((o) => o.ticker === ticker);
      if (!r) { field("ticker", ticker); return; }
      setT((prev) => ({
        ...prev,
        ticker:           r.ticker,
        entryPrice:       r.price,
        plannedTP:        [r.tp1, r.tp2, r.tp3],
        plannedSL:        r.tightStop ?? prev.plannedSL,
        linkedReportDate: r.reportDate,
        catalystType:     (r.catalystType as CatalystType) ?? prev.catalystType,
      }));
    }
  }

  function handleReportDateSelect(reportDate: string) {
    fillFromReportDate(t.ticker, reportDate);
  }

  const tickerDates = t.ticker ? (reportsByTicker[t.ticker] ?? []) : [];

  const cost = t.entryPrice * t.shares;
  const tp1Pct = t.entryPrice > 0 && t.plannedTP[0] > 0
    ? ((t.plannedTP[0] - t.entryPrice) / t.entryPrice * 100) : null;
  const slPct = t.entryPrice > 0 && t.plannedSL > 0
    ? ((t.plannedSL - t.entryPrice) / t.entryPrice * 100) : null;
  const rr = tp1Pct && slPct && slPct < 0
    ? (tp1Pct / Math.abs(slPct)) : null;

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border-bright, #334155)", borderRadius: 12, padding: "20px 22px" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "1px" }}>
        {initial ? "✏️ Edit Trade" : "➕ Log Trade"}
      </div>

      {/* Auto-fill banner */}
      {!initial && t.ticker && reportOptions.some((r) => r.ticker === t.ticker) && (
        <div style={{ fontSize: 11, color: "#10b981", fontFamily: "var(--font-mono, monospace)", marginBottom: 12, padding: "6px 10px", borderRadius: 6, background: "#10b98112", border: "1px solid #10b98130" }}>
          ✓ Auto-filled from {t.ticker} report · adjust any field as needed
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 14 }}>
        <Field label="Ticker">
          {!customTicker ? (
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={t.ticker || ""}
              onChange={(e) => handleTickerSelect(e.target.value)}
            >
              <option value="">— Select —</option>
              {reportOptions.map((r) => (
                <option key={r.ticker} value={r.ticker}>
                  {r.ticker}
                </option>
              ))}
              <option value="__other__">Other ticker…</option>
            </select>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={t.ticker}
                onChange={(e) => field("ticker", e.target.value.toUpperCase())}
                placeholder="NVDA"
                autoFocus
              />
              <button
                type="button"
                onClick={() => { setCustomTicker(false); field("ticker", ""); }}
                style={{ padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 11 }}
              >
                ←
              </button>
            </div>
          )}
        </Field>
        <Field label="Catalyst Type">
          <select style={{ ...inputStyle, cursor: "pointer" }} value={t.catalystType} onChange={(e) => field("catalystType", e.target.value as CatalystType)}>
            {CATALYST_TYPES.map((ct) => <option key={ct} value={ct}>{ct.replace(/_/g, " ")}</option>)}
          </select>
        </Field>
        <Field label="Entry Date">
          <input style={inputStyle} type="date" value={t.entryDate} onChange={(e) => field("entryDate", e.target.value)} />
        </Field>
        <Field label="Entry Price $">
          <input style={inputStyle} type="number" step="0.01" value={t.entryPrice || ""} onChange={(e) => field("entryPrice", parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label="Shares">
          <input style={inputStyle} type="number" step="any" value={t.shares || ""} onChange={(e) => field("shares", parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label="Tight Stop $">
          <input style={inputStyle} type="number" step="0.01" value={t.plannedSL || ""} onChange={(e) => field("plannedSL", parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label="TP1 $">
          <input style={inputStyle} type="number" step="0.01" value={t.plannedTP[0] || ""} onChange={(e) => setTP(0, parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label="TP2 $">
          <input style={inputStyle} type="number" step="0.01" value={t.plannedTP[1] || ""} onChange={(e) => setTP(1, parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label="TP3 $">
          <input style={inputStyle} type="number" step="0.01" value={t.plannedTP[2] || ""} onChange={(e) => setTP(2, parseFloat(e.target.value) || 0)} />
        </Field>
        <div style={{ gridColumn: "span 2" }}>
          <Field label="Report Date">
            {tickerDates.length > 0 ? (
              <select
                style={{ ...inputStyle, cursor: "pointer", width: "100%" }}
                value={t.linkedReportDate ?? ""}
                onChange={(e) => handleReportDateSelect(e.target.value)}
              >
                {tickerDates.map((d) => (
                  <option key={d.reportDate} value={d.reportDate}>
                    {d.reportDate.slice(0, 4)}-{d.reportDate.slice(4, 6)}-{d.reportDate.slice(6, 8)} · ${d.price.toFixed(2)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                style={{ ...inputStyle, width: "100%" }}
                value={t.linkedReportDate ?? todayYYYYMMDD()}
                onChange={(e) => field("linkedReportDate", e.target.value)}
                placeholder={todayYYYYMMDD()}
              />
            )}
          </Field>
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <Field label="Notes">
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: 56, width: "100%" }}
              value={t.notes ?? ""}
              onChange={(e) => field("notes", e.target.value)}
              placeholder="Thesis, market conditions, deviations from plan..."
            />
          </Field>
        </div>
      </div>

      {/* Live R/R preview */}
      {(cost > 0 || rr !== null) && (
        <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
          {cost > 0 && <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>Position: <strong style={{ color: "var(--text)" }}>${cost.toLocaleString()}</strong></span>}
          {slPct !== null && <span style={{ fontSize: 11, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>SL: {fmtPct(slPct)}</span>}
          {tp1Pct !== null && <span style={{ fontSize: 11, color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>TP1: {fmtPct(tp1Pct)}</span>}
          {rr !== null && <span style={{ fontSize: 11, color: "#3b82f6", fontFamily: "var(--font-mono, monospace)" }}>R/R: <strong>{rr.toFixed(1)} : 1</strong></span>}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          onClick={() => onSave(t)}
          style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}
        >
          Save Trade
        </button>
        <button
          onClick={onCancel}
          style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Exit Form ─────────────────────────────────────────────────────────────────

function ExitForm({ trade, onClose }: { trade: Trade; onClose: (updated: Trade) => void }) {
  const [price, setPrice] = useState("");
  const [shares, setShares] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const exitedSoFar = trade.exits.reduce((s, e) => s + e.shares, 0);
  const remaining = trade.shares - exitedSoFar;

  function submit() {
    const exit: TradeExit = {
      date, price: parseFloat(price), shares: parseInt(shares), note: note || undefined,
    };
    const newExits = [...trade.exits, exit];
    const totalExited = newExits.reduce((s, e) => s + e.shares, 0);
    const updated: Trade = {
      ...trade,
      exits: newExits,
      status: totalExited >= trade.shares ? "closed" : "open",
      realizedPnL: newExits.reduce((s, e) => s + e.shares * (e.price - trade.entryPrice), 0),
    };
    onClose(updated);
  }

  return (
    <div style={{ background: "var(--bg, #0f172a)", border: "1px solid #f59e0b40", borderRadius: 10, padding: "14px 16px", marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b", fontFamily: "var(--font-mono, monospace)", marginBottom: 10 }}>
        LOG EXIT · {remaining} shares remaining
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
        <Field label="Exit Date">
          <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Exit Price $">
          <input style={inputStyle} type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Shares">
          <input style={inputStyle} type="number" max={remaining} value={shares} onChange={(e) => setShares(e.target.value)} />
        </Field>
        <Field label="Note">
          <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="TP1 hit, stop, etc." />
        </Field>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button onClick={submit} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "#f59e0b", color: "#000", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}>
          Log Exit
        </button>
        <button onClick={() => onClose(trade)} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Trade Row ─────────────────────────────────────────────────────────────────

function TradeRow({ trade, priceInfo, onEdit, onDelete, onSaveExit }: {
  trade: Trade;
  priceInfo: PriceInfo | null;
  onEdit: () => void;
  onDelete: () => void;
  onSaveExit: (updated: Trade) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showExitForm, setShowExitForm] = useState(false);

  const currentPrice = priceInfo?.price ?? null;
  const posState     = trade.status === "open" ? getPositionState(trade, currentPrice) : "UNKNOWN";
  const stateMeta    = STATE_META[posState];
  const isStopLoss   = posState === "STOP_LOSS";

  const pnl = trade.status === "closed"
    ? (trade.realizedPnL ?? calcPnL(trade))
    : null;
  // Unrealized P&L for open positions
  const unrealizedPnL = trade.status === "open" && currentPrice !== null
    ? (currentPrice - trade.entryPrice) * trade.shares
    : null;
  const unrealizedPct = trade.status === "open" && currentPrice !== null && trade.entryPrice > 0
    ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
    : null;

  const cost = trade.entryPrice * trade.shares;
  const days = holdDays(trade);
  const tp1 = trade.plannedTP[0];
  const adherent = trade.status === "closed" && trade.exits.length > 0 && tp1 > 0
    ? trade.exits.reduce((s, e) => s + e.price * e.shares, 0) / trade.exits.reduce((s, e) => s + e.shares, 0) >= tp1
    : null;

  return (
    <div style={{
      border: `1px solid ${isStopLoss ? "#ef444440" : "var(--border)"}`,
      borderRadius: 10, overflow: "hidden", marginBottom: 8,
      background: isStopLoss ? "#ef44440a" : "transparent",
    }}>
      {/* Summary row */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", background: isStopLoss ? "#ef44440d" : "var(--card)", flexWrap: "wrap" }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Alert icon for stop loss */}
        {isStopLoss && (
          <span style={{ fontSize: 16, animation: "pulse 1.5s ease-in-out infinite" }}>🚨</span>
        )}

        {/* Ticker */}
        <div style={{ minWidth: 72 }}>
          <Link href={`/report/${trade.ticker.toLowerCase()}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none" }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>{trade.ticker}</span>
          </Link>
          <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
            {trade.shares} sh
          </div>
        </div>

        {/* Position state badge — open trades only */}
        {trade.status === "open" && posState !== "UNKNOWN" && (
          <span style={{
            fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 5,
            background: stateMeta.bg, color: stateMeta.color,
            border: `1px solid ${stateMeta.color}30`,
            fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap",
          }}>
            {stateMeta.icon} {stateMeta.label}
          </span>
        )}
        {trade.status === "closed" && (
          <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 5, background: "#64748b18", color: "#64748b", border: "1px solid #64748b30", fontFamily: "var(--font-mono, monospace)" }}>
            CLOSED
          </span>
        )}

        {/* Catalyst type */}
        <div style={{ flex: 1, fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", minWidth: 80 }}>
          {trade.catalystType.replace(/_/g, " ")}
        </div>

        {/* Entry price */}
        <div style={{ textAlign: "right", minWidth: 64 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>entry</div>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>${trade.entryPrice.toFixed(2)}</div>
        </div>

        {/* Current price (open) or realized P&L (closed) */}
        <div style={{ textAlign: "right", minWidth: 80 }}>
          {trade.status === "open" && currentPrice !== null ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", fontFamily: "var(--font-mono, monospace)" }}>${currentPrice.toFixed(2)}</div>
              {unrealizedPct !== null && (
                <div style={{ fontSize: 10, fontWeight: 700, color: pnlColor(unrealizedPct), fontFamily: "var(--font-mono, monospace)" }}>
                  {unrealizedPct >= 0 ? "+" : ""}{unrealizedPct.toFixed(1)}%
                </div>
              )}
            </>
          ) : pnl !== null ? (
            <div style={{ fontSize: 13, fontWeight: 800, color: pnlColor(pnl), fontFamily: "var(--font-mono, monospace)" }}>{fmt$(pnl)}</div>
          ) : (
            <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>—</span>
          )}
        </div>

        {/* Days held */}
        <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", minWidth: 28, textAlign: "right" }}>
          {days}d
        </div>

        {/* Plan adherence (closed) */}
        {adherent !== null && (
          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: adherent ? "#10b98118" : "#ef444418", color: adherent ? "#10b981" : "#ef4444", fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>
            {adherent ? "✓ plan" : "✗ plan"}
          </span>
        )}

        {/* Expand arrow */}
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "18px 20px", background: "#070d18", borderTop: "1px solid rgba(255,255,255,0.05)" }}>

          {/* Price source badge */}
          {priceInfo && trade.status === "open" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0f172a", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px" }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: "var(--text)", fontFamily: "var(--font-mono, monospace)" }}>
                  ${priceInfo.price.toFixed(2)}
                </span>
                {unrealizedPct !== null && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: pnlColor(unrealizedPct), fontFamily: "var(--font-mono, monospace)" }}>
                    {unrealizedPct >= 0 ? "+" : ""}{unrealizedPct.toFixed(1)}%
                  </span>
                )}
                {unrealizedPnL !== null && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: pnlColor(unrealizedPnL), fontFamily: "var(--font-mono, monospace)" }}>
                    {fmt$(unrealizedPnL)}
                  </span>
                )}
              </div>
              {(() => {
                const s = priceStaleness(priceInfo);
                return (
                  <span style={{ fontSize: 10, color: s.color, fontFamily: "var(--font-mono, monospace)" }}>
                    from report · {s.label}
                  </span>
                );
              })()}
            </div>
          )}

          {/* Metric cards */}
          {(() => {
            const position = trade.entryPrice * trade.shares;
            const slPct = trade.entryPrice > 0 && trade.plannedSL > 0
              ? ((trade.plannedSL - trade.entryPrice) / trade.entryPrice * 100) : null;
            const tp1Pct = trade.entryPrice > 0 && trade.plannedTP[0] > 0
              ? ((trade.plannedTP[0] - trade.entryPrice) / trade.entryPrice * 100) : null;
            const rr = tp1Pct && slPct && slPct < 0
              ? (tp1Pct / Math.abs(slPct)) : null;
            const cards = [
              position > 0 && { label: "Position Size", value: `$${position.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "#e2e8f0", accent: "#38bdf8" },
              slPct !== null && { label: "Stop Loss", value: `${slPct.toFixed(1)}%`, color: "#ef4444", accent: "#ef4444" },
              tp1Pct !== null && { label: "TP1 Upside", value: `+${tp1Pct.toFixed(1)}%`, color: "#10b981", accent: "#10b981" },
              rr !== null && { label: "Risk / Reward", value: `${rr.toFixed(1)} : 1`, color: "#3b82f6", accent: "#3b82f6" },
            ].filter(Boolean) as { label: string; value: string; color: string; accent: string }[];
            if (cards.length === 0) return null;
            return (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(cards.length, 4)}, minmax(0,1fr))`, gap: 8, marginBottom: 16 }}>
                {cards.map((c) => (
                  <div key={c.label} style={{ background: `${c.accent}0d`, border: `1px solid ${c.accent}28`, borderRadius: 9, padding: "10px 13px" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "1.2px", fontFamily: "var(--font-mono, monospace)", marginBottom: 5 }}>{c.label}</div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: c.color, fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.5px" }}>{c.value}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Price levels track */}
          {(trade.plannedSL > 0 || trade.plannedTP[0] > 0) && (() => {
            const cp   = currentPrice;
            const sl   = trade.plannedSL;
            const ep   = trade.entryPrice;
            const [t1, t2, t3] = trade.plannedTP;
            const sc   = stateMeta.color;

            // Inline NOW node
            const NowNode = () => (
              <div style={{ display: "flex", alignItems: "center", gap: 5, background: `${sc}15`, border: `1px solid ${sc}50`, borderRadius: 7, padding: "5px 10px", boxShadow: `0 0 8px ${sc}30`, flexShrink: 0 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: sc, flexShrink: 0, boxShadow: `0 0 4px ${sc}` }} />
                <span style={{ fontSize: 9, color: sc, fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>NOW</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: sc, fontFamily: "var(--font-mono, monospace)" }}>${cp!.toFixed(2)}</span>
              </div>
            );
            const Line = ({ g1, g2 }: { g1: string; g2: string }) => (
              <div style={{ flex: 1, minWidth: 10, height: 1, background: `linear-gradient(90deg, ${g1}, ${g2})`, borderRadius: 1 }} />
            );

            const showNow = cp !== null && trade.status === "open";
            const belowSL      = showNow && sl > 0 && cp! < sl;
            const betweenSLEp  = showNow && sl > 0 && cp! >= sl && cp! < ep;
            const betweenEpT1  = showNow && t1 > 0 && cp! >= ep && cp! < t1;
            const betweenT1T2  = showNow && t1 > 0 && t2 > 0 && cp! >= t1 && cp! < t2;
            const betweenT2T3  = showNow && t2 > 0 && t3 > 0 && cp! >= t2 && cp! < t3;
            const aboveT3      = showNow && t3 > 0 && cp! >= t3;
            // fallback: above entry, no TPs set
            const aboveEpNoTP  = showNow && t1 === 0 && cp! >= ep;

            return (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "1.2px", fontFamily: "var(--font-mono, monospace)", marginBottom: 8 }}>Price Levels</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>

                  {/* NOW — below SL */}
                  {belowSL && <><NowNode /><Line g1={`${sc}60`} g2="#ef444450" /></>}

                  {/* SL node */}
                  {sl > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#ef444412", border: "1px solid #ef444332", borderRadius: 7, padding: "5px 10px", flexShrink: 0 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: "#64748b", fontFamily: "var(--font-mono, monospace)" }}>SL</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>${sl}</span>
                    </div>
                  )}

                  {/* NOW — between SL and Entry */}
                  {betweenSLEp
                    ? <><Line g1="#ef444430" g2={`${sc}60`} /><NowNode /><Line g1={`${sc}60`} g2="#38bdf840" /></>
                    : <Line g1="#ef444430" g2="#38bdf840" />
                  }

                  {/* Entry node */}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#1e293b", border: "1px solid #2d3f55", borderRadius: 7, padding: "5px 10px", flexShrink: 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#38bdf8", flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: "#64748b", fontFamily: "var(--font-mono, monospace)" }}>Entry</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", fontFamily: "var(--font-mono, monospace)" }}>${ep.toFixed(2)}</span>
                  </div>

                  {(t1 > 0 || t2 > 0 || t3 > 0) && (
                    <>
                      {/* NOW — between Entry and TP1 */}
                      {betweenEpT1
                        ? <><Line g1="#38bdf840" g2={`${sc}60`} /><NowNode /><Line g1={`${sc}60`} g2="#10b98160" /></>
                        : <Line g1="#38bdf840" g2="#10b98160" />
                      }
                      {/* NOW — above entry, no TPs */}
                      {aboveEpNoTP && <><NowNode /></>}

                      {t1 > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#10b98110", border: "1px solid #10b98128", borderRadius: 7, padding: "5px 10px", flexShrink: 0 }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
                          <span style={{ fontSize: 9, color: "#475569", fontFamily: "var(--font-mono, monospace)" }}>TP1</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>${t1}</span>
                        </div>
                      )}

                      {t2 > 0 && (
                        <>
                          {betweenT1T2
                            ? <><Line g1="#10b98150" g2={`${sc}60`} /><NowNode /><Line g1={`${sc}60`} g2="#34d39960" /></>
                            : <Line g1="#10b98150" g2="#34d39960" />
                          }
                          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#10b98118", border: "1px solid #10b98135", borderRadius: 7, padding: "5px 10px", flexShrink: 0 }}>
                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", flexShrink: 0 }} />
                            <span style={{ fontSize: 9, color: "#475569", fontFamily: "var(--font-mono, monospace)" }}>TP2</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "#34d399", fontFamily: "var(--font-mono, monospace)" }}>${t2}</span>
                          </div>
                        </>
                      )}

                      {t3 > 0 && (
                        <>
                          {betweenT2T3
                            ? <><Line g1="#34d39950" g2={`${sc}60`} /><NowNode /><Line g1={`${sc}60`} g2="#6ee7b760" /></>
                            : <Line g1="#34d39950" g2="#6ee7b760" />
                          }
                          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#10b98122", border: "1px solid #10b98145", borderRadius: 7, padding: "5px 10px", flexShrink: 0 }}>
                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#6ee7b7", flexShrink: 0 }} />
                            <span style={{ fontSize: 9, color: "#475569", fontFamily: "var(--font-mono, monospace)" }}>TP3</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "#6ee7b7", fontFamily: "var(--font-mono, monospace)" }}>${t3}</span>
                          </div>
                          {/* NOW — above TP3 (moon!) */}
                          {aboveT3 && <><Line g1="#6ee7b760" g2={`${sc}80`} /><NowNode /></>}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Entry date + report link */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono, monospace)" }}>
              <span style={{ color: "#1e3a5f", marginRight: 6, textTransform: "uppercase", fontSize: 9, letterSpacing: "1px", fontWeight: 700 }}>Entered</span>
              <strong style={{ color: "#64748b" }}>{trade.entryDate}</strong>
            </div>
            {trade.linkedReportDate && (
              <Link href={`/report/${trade.ticker.toLowerCase()}`} style={{ fontSize: 10, color: "#38bdf8", fontFamily: "var(--font-mono, monospace)", textDecoration: "none", background: "#38bdf80f", border: "1px solid #38bdf822", borderRadius: 6, padding: "3px 9px" }}>
                Report {trade.linkedReportDate} →
              </Link>
            )}
          </div>

          {/* Exits */}
          {trade.exits.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "1.2px", fontFamily: "var(--font-mono, monospace)", marginBottom: 8 }}>Exit History</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {trade.exits.map((ex, i) => {
                  const exPnl = ex.shares * (ex.price - trade.entryPrice);
                  return (
                    <div key={i} style={{ display: "flex", gap: 12, fontSize: 11, fontFamily: "var(--font-mono, monospace)", flexWrap: "wrap", padding: "7px 11px", borderRadius: 7, alignItems: "center", background: exPnl >= 0 ? "#10b98108" : "#ef444408", border: `1px solid ${exPnl >= 0 ? "#10b98120" : "#ef444420"}` }}>
                      <span style={{ color: "#475569" }}>{ex.date}</span>
                      <span style={{ color: "#94a3b8", fontWeight: 700 }}>${ex.price.toFixed(2)}</span>
                      <span style={{ color: "#475569" }}>{ex.shares} sh</span>
                      <span style={{ color: pnlColor(exPnl), fontWeight: 800 }}>{fmt$(exPnl)}</span>
                      {ex.note && <span style={{ color: "#475569", fontStyle: "italic" }}>{ex.note}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          {trade.notes && (
            <div style={{ fontSize: 11, color: "#475569", fontFamily: "var(--font-body, sans-serif)", lineHeight: 1.6, marginBottom: 14, padding: "8px 12px", background: "#0d1424", borderRadius: 7, borderLeft: "2px solid #1e3a5f", fontStyle: "italic" }}>
              {trade.notes}
            </div>
          )}

          {/* Exit form */}
          {showExitForm && (
            <ExitForm
              trade={trade}
              onClose={(updated) => { setShowExitForm(false); onSaveExit(updated); }}
            />
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
            {trade.status === "open" && !showExitForm && (
              <button
                onClick={() => setShowExitForm(true)}
                style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #f59e0b45", background: "linear-gradient(135deg,#f59e0b12,#f59e0b20)", color: "#f59e0b", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.3px" }}
              >
                ↗ Log Exit
              </button>
            )}
            <button
              onClick={onEdit}
              style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #1e293b", background: "transparent", color: "#475569", fontSize: 11, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}
            >
              ✏ Edit
            </button>
            <button
              onClick={onDelete}
              style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #ef444330", background: "#ef444408", color: "#ef4444", fontSize: 11, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}
            >
              ✕ Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export interface ReportDateOption {
  reportDate:   string; // YYYYMMDD
  price:        number;
  tp1:          number;
  tp2:          number;
  tp3:          number;
  tightStop:    number | null;
  catalystType: string | null;
}

export function JournalContent({ initialTrades, stats, reportOptions = [], priceMap = {}, reportsByTicker = {} }: {
  initialTrades: Trade[];
  stats: JournalStats;
  reportOptions?: ReportOption[];
  priceMap?: Record<string, PriceInfo>;
  reportsByTicker?: Record<string, ReportDateOption[]>;
}) {
  const [trades, setTrades] = useState<Trade[]>(initialTrades);
  const [showForm, setShowForm] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "closed">("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [livePriceMap, setLivePriceMap] = useState<Record<string, PriceInfo>>(priceMap);
  const [priceStatus, setPriceStatus] = useState<"loading" | "live" | "error" | "idle">("idle");

  // Fetch live prices from Yahoo Finance on mount
  useEffect(() => {
    const openTickers = [...new Set(
      initialTrades.filter((t) => t.status === "open").map((t) => t.ticker)
    )];
    if (openTickers.length === 0) return;

    setPriceStatus("loading");
    fetch(`/api/prices?tickers=${openTickers.join(",")}`)
      .then((r) => r.json())
      .then((data: Record<string, LivePrice>) => {
        setLivePriceMap((prev) => {
          const updated = { ...prev };
          for (const [ticker, lp] of Object.entries(data)) {
            updated[ticker] = {
              price:       lp.price,
              generatedAt: lp.fetchedAt,
              companyName: prev[ticker]?.companyName ?? ticker,
              isLive:      true,
              changePct:   lp.changePct,
              marketState: lp.marketState,
            };
          }
          return updated;
        });
        setPriceStatus("live");
      })
      .catch(() => setPriceStatus("error"));
  }, []);

  const liveStats = (() => {
    // recompute stats from live trades (client-side after mutations)
    const closed = trades.filter((t) => t.status === "closed");
    const wins = closed.filter((t) => (t.realizedPnL ?? calcPnL(t)) > 0);
    const pnls = closed.map((t) => t.realizedPnL ?? calcPnL(t));
    const winRate = closed.length === 0 ? 0 : wins.length / closed.length;
    const totalPnL = pnls.reduce((s, v) => s + v, 0);
    return { winRate, totalPnL, openCount: trades.filter((t) => t.status === "open").length };
  })();

  const handleSave = useCallback(async (trade: Trade) => {
    setTrades((prev) => {
      const idx = prev.findIndex((t) => t.id === trade.id);
      return idx >= 0 ? prev.map((t) => t.id === trade.id ? trade : t) : [...prev, trade];
    });
    await apiSave(trade);
    setShowForm(false);
    setEditTrade(null);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this trade?")) return;
    setTrades((prev) => prev.filter((t) => t.id !== id));
    await apiDelete(id);
  }, []);

  const filtered = trades.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterType !== "all" && t.catalystType !== filterType) return false;
    return true;
  });

  const allTypes = Array.from(new Set(trades.map((t) => t.catalystType)));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>
      {/* Private badge + header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/catalyst" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>← Catalyst</Link>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 6,
            background: "#ef444418", color: "#ef4444", border: "1px solid #ef444430",
            fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.5px",
          }}>
            🔒 PRIVATE — local only
          </span>
          {/* Live price status */}
          {priceStatus === "loading" && (
            <span style={{ fontSize: 10, color: "#f59e0b", fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>
              ⟳ fetching live prices…
            </span>
          )}
          {priceStatus === "live" && (
            <span style={{ fontSize: 10, color: "#10b981", fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>
              ● LIVE · Yahoo Finance
            </span>
          )}
          {priceStatus === "error" && (
            <span style={{ fontSize: 10, color: "#ef4444", fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>
              ⚠ price fetch failed · using report data
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowForm(true); setEditTrade(null); }}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}
        >
          + Log Trade
        </button>
      </div>

      <h1 style={{ fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 900, margin: "0 0 4px", letterSpacing: "-0.5px", fontFamily: "var(--font-display, sans-serif)" }}>
        Trade Journal
      </h1>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 24px", fontFamily: "var(--font-mono, monospace)" }}>
        {trades.length} trades · private/journal.json · never committed to git
      </p>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 24 }}>
        <StatCard label="Total P&L" value={fmt$(liveStats.totalPnL)} color={pnlColor(liveStats.totalPnL)} />
        <StatCard label="Win Rate" value={`${(liveStats.winRate * 100).toFixed(0)}%`} color="#10b981" sub={<WinBar rate={liveStats.winRate} /> as unknown as string} />
        <StatCard label="Open" value={`${liveStats.openCount}`} color="#f59e0b" />
        <StatCard label="Expectancy" value={fmt$(stats.expectancy)} color={pnlColor(stats.expectancy)} />
        <StatCard label="Plan Adherence" value={`${(stats.planAdherence * 100).toFixed(0)}%`} color="#3b82f6" />
        <StatCard label="Avg Hold" value={`${stats.avgHoldDays.toFixed(0)}d`} />
      </div>

      {/* Win rate by catalyst type */}
      {Object.keys(stats.byType).length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)", marginBottom: 12 }}>
            Win Rate by Catalyst Type
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {Object.entries(stats.byType).map(([type, data]) => (
              <div key={type} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{type.replace(/_/g, " ")}</span>
                  <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>n={data.trades}</span>
                </div>
                <WinBar rate={data.trades > 0 ? data.wins / data.trades : 0} />
                <span style={{ fontSize: 10, color: pnlColor(data.totalPnL), fontFamily: "var(--font-mono, monospace)" }}>{fmt$(data.totalPnL)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {(showForm || editTrade) && (
        <div style={{ marginBottom: 20 }}>
          <TradeForm
            initial={editTrade ?? undefined}
            reportOptions={reportOptions}
            reportsByTicker={reportsByTicker}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditTrade(null); }}
          />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {(["all", "open", "closed"] as const).map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{
            padding: "4px 12px", borderRadius: 7, border: "1px solid var(--border)", fontSize: 11, fontWeight: 700, cursor: "pointer",
            background: filterStatus === s ? "#10b98120" : "transparent",
            color: filterStatus === s ? "#10b981" : "var(--muted)",
            fontFamily: "var(--font-mono, monospace)",
          }}>
            {s.toUpperCase()}
          </button>
        ))}
        {allTypes.length > 1 && (
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ ...inputStyle, width: "auto", padding: "4px 10px", fontSize: 11, cursor: "pointer" }}
          >
            <option value="all">All types</option>
            {allTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
        )}
      </div>

      {/* Trade list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📒</div>
          <p style={{ margin: 0, fontSize: 14 }}>No trades yet. Hit "+ Log Trade" to start.</p>
        </div>
      ) : (
        <div>
          {filtered.map((trade) => (
            <TradeRow
              key={trade.id}
              trade={trade}
              priceInfo={livePriceMap[trade.ticker] ?? null}
              onEdit={() => { setEditTrade(trade); setShowForm(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              onDelete={() => handleDelete(trade.id)}
              onSaveExit={(updated) => handleSave(updated)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
