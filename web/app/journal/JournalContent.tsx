"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { LivePrice } from "@/app/api/prices/route";
import Link from "next/link";
import { useLang } from "@/lib/LanguageContext";
import { Trade, CatalystType, TradeExit, ValidatorResult, AiValidateQuota } from "@/lib/journal-types";
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

function parseDecimalInput(raw: string): number {
  const n = parseFloat(raw);
  return Number.isNaN(n) ? 0 : n;
}

function fmtShares(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  const rounded = parseFloat(n.toFixed(6));
  return String(rounded);
}

function fmtTradeCount(n: number): string {
  return n === 1 ? "1 trade" : `${n} trades`;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (Array.isArray(body.message)) return body.message.join(", ");
  return body.message ?? fallback;
}

async function apiCreate(trade: Trade): Promise<Trade> {
  const res = await fetch("/api/journal/trades", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trade),
  });
  if (!res.ok) throw new Error(await readError(res, `Create failed (${res.status})`));
  return res.json();
}

async function apiUpdate(trade: Trade): Promise<Trade> {
  const res = await fetch(`/api/journal/trades/${trade.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trade),
  });
  if (!res.ok) throw new Error(await readError(res, `Update failed (${res.status})`));
  return res.json();
}

async function apiAddExit(tradeId: string, exit: TradeExit): Promise<Trade> {
  const res = await fetch(`/api/journal/trades/${tradeId}/exits`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(exit),
  });
  if (!res.ok) throw new Error(await readError(res, `Exit failed (${res.status})`));
  return res.json();
}

async function apiDelete(id: string): Promise<void> {
  const res = await fetch(`/api/journal/trades/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readError(res, `Delete failed (${res.status})`));
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
  const [sharesInput, setSharesInput] = useState(
    initial && initial.shares > 0 ? String(initial.shares) : ""
  );
  const [sharesInvalid, setSharesInvalid] = useState(false);
  const sharesInputRef = useRef<HTMLInputElement>(null);
  const [customTicker, setCustomTicker] = useState(
    initial ? !reportOptions.some((r) => r.ticker === initial.ticker) : false
  );
  // Progressive disclosure: a brand-new trade starts with only the Ticker
  // field visible — the rest of the form (9 more fields) was overwhelming
  // users into dropping off before ever picking a ticker, even though most
  // of those fields auto-fill once a ticker with a report is chosen. Editing
  // an existing trade always shows the full form immediately (ticker's
  // already decided, nothing left to "reveal").
  const [revealed, setRevealed] = useState(!!initial);

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
      setRevealed(true);
      field("ticker", "");
      return;
    }
    setCustomTicker(false);
    setRevealed(true);
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

  // Lets the user back out of a chosen ticker without cancelling the whole
  // form — resets to the Step 1 ticker picker with a clean slate.
  function changeTicker() {
    setT((prev) => ({ ...emptyTrade(), id: prev.id }));
    setSharesInput("");
    setCustomTicker(false);
    setRevealed(false);
  }

  function handleReportDateSelect(reportDate: string) {
    fillFromReportDate(t.ticker, reportDate);
  }

  const tickerDates = t.ticker ? (reportsByTicker[t.ticker] ?? []) : [];

  const shares = parseDecimalInput(sharesInput);
  const cost = t.entryPrice * shares;

  function handleSubmit() {
    if (shares <= 0) {
      setSharesInvalid(true);
      sharesInputRef.current?.focus();
      return;
    }
    onSave({ ...t, shares });
  }
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

      {/* Step 1 — ticker-only picker, shown until a ticker is chosen. Most of
          the rest of the form auto-fills from the ticker's report, so making
          this the one thing users see first (instead of 10 blank fields at
          once) is the whole fix for the drop-off. */}
      {!revealed && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "28px 16px" }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "#10b981", fontFamily: "var(--font-mono, monospace)", textTransform: "uppercase", letterSpacing: "1.5px" }}>
            Step 1 — Pick a ticker
          </span>
          <select
            autoFocus
            style={{
              ...inputStyle,
              cursor: "pointer",
              maxWidth: 280,
              width: "100%",
              fontSize: 16,
              fontWeight: 800,
              textAlign: "center",
              textAlignLast: "center",
              padding: "12px 40px 12px 14px",
              border: "1.5px solid #10b981",
              boxShadow: "0 0 0 4px #10b98120, 0 0 18px #10b98125",
              appearance: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2310b981' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 16px center",
              backgroundSize: "14px",
            }}
            value=""
            onChange={(e) => handleTickerSelect(e.target.value)}
          >
            <option value="" disabled>— Select ticker —</option>
            {reportOptions.map((r) => (
              <option key={r.ticker} value={r.ticker}>
                {r.ticker}
              </option>
            ))}
            <option value="__other__">Other ticker…</option>
          </select>
          <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", textAlign: "center", maxWidth: 320 }}>
            We&apos;ll auto-fill entry price, TP1–3 &amp; tight stop from the latest report — just confirm shares after.
          </span>
        </div>
      )}

      {revealed && (
      <>
      {/* Auto-fill banner */}
      {!initial && t.ticker && reportOptions.some((r) => r.ticker === t.ticker) && (
        <div style={{ fontSize: 11, color: "#10b981", fontFamily: "var(--font-mono, monospace)", marginBottom: 12, padding: "6px 10px", borderRadius: 6, background: "#10b98112", border: "1px solid #10b98130" }}>
          ✓ Auto-filled from {t.ticker} report · adjust any field as needed
        </div>
      )}

      <div className="jv-field-reveal" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 14 }}>
        <Field label="Ticker">
          {!customTicker ? (
            <div style={{ display: "flex", gap: 6 }}>
              <select
                style={{ ...inputStyle, flex: 1, cursor: "pointer" }}
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
              {!initial && (
                <button
                  type="button"
                  onClick={changeTicker}
                  title="Change ticker"
                  style={{ padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 11 }}
                >
                  ↺
                </button>
              )}
            </div>
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
                onClick={() => {
                  if (initial) {
                    setCustomTicker(false);
                    field("ticker", "");
                  } else {
                    changeTicker();
                  }
                }}
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
          <input
            ref={sharesInputRef}
            style={sharesInvalid ? {
              ...inputStyle,
              border: "1.5px solid #ef4444",
              boxShadow: "0 0 0 3px #ef444425",
            } : inputStyle}
            type="text"
            inputMode="decimal"
            value={sharesInput}
            onChange={(e) => {
              setSharesInput(e.target.value);
              if (sharesInvalid) setSharesInvalid(false);
            }}
            placeholder="0"
            aria-invalid={sharesInvalid || undefined}
          />
          {sharesInvalid && (
            <span style={{ display: "block", marginTop: 4, fontSize: 10, color: "#ef4444", fontFamily: "var(--font-mono, monospace)" }}>
              Enter a share amount greater than 0
            </span>
          )}
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
      </>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        {revealed && (
          <button
            onClick={handleSubmit}
            style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}
          >
            Save Trade
          </button>
        )}
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

function ExitForm({ trade, onSubmit, onCancel }: {
  trade: Trade;
  onSubmit: (exit: TradeExit) => void;
  onCancel: () => void;
}) {
  const exitedSoFar = trade.exits.reduce((s, e) => s + e.shares, 0);
  const remaining = trade.shares - exitedSoFar;

  const [price, setPrice] = useState("");
  const [shares, setShares] = useState(remaining > 0 ? fmtShares(remaining) : "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  function submit() {
    const exitShares = parseDecimalInput(shares);
    if (exitShares <= 0) {
      alert("Please enter shares greater than 0.");
      return;
    }
    if (exitShares > remaining + 1e-9) {
      alert(`Cannot exit more than ${fmtShares(remaining)} shares remaining.`);
      return;
    }
    onSubmit({ date, price: parseFloat(price), shares: exitShares, note: note || undefined });
  }

  return (
    <div style={{ background: "var(--bg, #0f172a)", border: "1px solid #f59e0b40", borderRadius: 10, padding: "14px 16px", marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b", fontFamily: "var(--font-mono, monospace)", marginBottom: 10 }}>
        LOG EXIT · {fmtShares(remaining)} shares remaining
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
        <Field label="Exit Date">
          <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Exit Price $">
          <input style={inputStyle} type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Shares">
          <input style={inputStyle} type="text" inputMode="decimal" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Note">
          <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="TP1 hit, stop, etc." />
        </Field>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button onClick={submit} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "#f59e0b", color: "#000", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}>
          Log Exit
        </button>
        <button onClick={onCancel} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Trade Row ─────────────────────────────────────────────────────────────────

const VALIDATOR_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  green:  { bg: "#10b98112", border: "#10b98135", text: "#10b981" },
  yellow: { bg: "#f59e0b12", border: "#f59e0b35", text: "#f59e0b" },
  red:    { bg: "#ef444412", border: "#ef444435", text: "#ef4444" },
};

function ValidatorSection({ result, generatedAt }: { result: ValidatorResult; generatedAt: string }) {
  const { lang } = useLang();
  const th = lang === "th";
  const c = VALIDATOR_COLORS[result.color] ?? VALIDATOR_COLORS.yellow;
  const summaryText = th ? (result.summaryTh || result.summary) : result.summary;
  const actionText = th ? (result.actionTh || result.action) : result.action;
  const d = new Date(generatedAt);
  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div style={{ marginBottom: 14, borderRadius: 9, border: `1px solid ${c.border}`, background: c.bg, padding: "11px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "1.2px", fontFamily: "var(--font-mono, monospace)" }}>
          Validator
        </span>
        <span style={{
          fontSize: 10, fontWeight: 900, padding: "2px 9px", borderRadius: 5,
          background: c.bg, color: c.text, border: `1px solid ${c.border}`,
          fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.5px",
        }}>
          {result.verdict}
        </span>
        {result.stopBreached && (
          <span style={{ fontSize: 9, fontWeight: 800, color: "#ef4444", fontFamily: "var(--font-mono, monospace)", background: "#ef444415", border: "1px solid #ef444330", borderRadius: 5, padding: "2px 7px" }}>
            🚨 STOP BREACHED
          </span>
        )}
        {result.atRisk && !result.stopBreached && (
          <span style={{ fontSize: 9, fontWeight: 800, color: "#f59e0b", fontFamily: "var(--font-mono, monospace)", background: "#f59e0b12", border: "1px solid #f59e0b30", borderRadius: 5, padding: "2px 7px" }}>
            ⚠ AT RISK
          </span>
        )}
        <span style={{ fontSize: 9, color: "#334155", fontFamily: "var(--font-mono, monospace)", marginLeft: "auto" }}>
          {dateStr}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "var(--font-body, sans-serif)", lineHeight: 1.6, marginBottom: 6 }}>
        {summaryText}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: c.text, fontFamily: "var(--font-mono, monospace)" }}>
        → {actionText}
      </div>
    </div>
  );
}

function TradeRow({ trade, priceInfo, validatorResult, validationGeneratedAt, expanded, onToggleExpand, onEdit, onDelete, onAddExit }: {
  trade: Trade;
  priceInfo: PriceInfo | null;
  validatorResult?: ValidatorResult;
  validationGeneratedAt?: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddExit: (exit: TradeExit) => void;
}) {
  const { lang } = useLang();
  const th = lang === "th";
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
        onClick={onToggleExpand}
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
            {fmtShares(trade.shares)} sh
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

        {/* Entry / now / hold / adherence — grouped so mobile can drop it to its own full-width row */}
        <div className="trade-stats-row" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Entry price */}
          <div style={{ textAlign: "right", minWidth: 64 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>entry</div>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>${trade.entryPrice.toFixed(2)}</div>
          </div>

          {/* Current price (open) or realized P&L (closed) */}
          <div style={{ textAlign: "right" }}>
            {trade.status === "open" && currentPrice !== null ? (
              <div style={{ display: "flex", gap: 14, justifyContent: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>now</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", fontFamily: "var(--font-mono, monospace)" }}>${currentPrice.toFixed(2)}</div>
                </div>
                {unrealizedPct !== null && (
                  <div>
                    <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>changes</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: pnlColor(unrealizedPct), fontFamily: "var(--font-mono, monospace)" }}>
                      {unrealizedPct >= 0 ? "+" : ""}{unrealizedPct.toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            ) : pnl !== null ? (
              <>
                <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>P&L</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: pnlColor(pnl), fontFamily: "var(--font-mono, monospace)" }}>{fmt$(pnl)}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>P&L</div>
                <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>—</span>
              </>
            )}
          </div>

          {/* Days held */}
          <div style={{ textAlign: "right", minWidth: 28 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>hold</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono, monospace)" }}>{days}d</div>
          </div>

          {/* Plan adherence (closed) */}
          {adherent !== null && (
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: adherent ? "#10b98118" : "#ef444418", color: adherent ? "#10b981" : "#ef4444", fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>
              {adherent ? "✓ plan" : "✗ plan"}
            </span>
          )}
        </div>

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
                    {s.label}
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
              <div className="trade-stat-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(cards.length, 4)}, minmax(0,1fr))`, gap: 8, marginBottom: 16 }}>
                {cards.map((c) => (
                  <div key={c.label} style={{ background: `${c.accent}0d`, border: `1px solid ${c.accent}28`, borderRadius: 9, padding: "10px 13px", minWidth: 0 }}>
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

            // Mobile vertical ladder: same levels, sorted high-to-low by price,
            // with NOW inserted at its actual position instead of computed via
            // the "between X and Y" flags above (those only make sense for the
            // horizontal rail's left-to-right layout).
            type Level = { key: string; label: string; price: number; color: string; bg: string; border: string; isNow?: boolean };
            const mobileLevels: Level[] = [];
            if (t3 > 0) mobileLevels.push({ key: "tp3", label: "TP3", price: t3, color: "#6ee7b7", bg: "#10b98122", border: "#10b98145" });
            if (t2 > 0) mobileLevels.push({ key: "tp2", label: "TP2", price: t2, color: "#34d399", bg: "#10b98118", border: "#10b98135" });
            if (t1 > 0) mobileLevels.push({ key: "tp1", label: "TP1", price: t1, color: "#10b981", bg: "#10b98110", border: "#10b98128" });
            mobileLevels.push({ key: "entry", label: "Entry", price: ep, color: "#94a3b8", bg: "#1e293b", border: "#2d3f55" });
            if (sl > 0) mobileLevels.push({ key: "sl", label: "SL", price: sl, color: "#ef4444", bg: "#ef444412", border: "#ef444332" });
            mobileLevels.sort((a, b) => b.price - a.price);
            if (showNow) {
              const nowLevel: Level = { key: "now", label: "NOW", price: cp!, color: sc, bg: `${sc}15`, border: `${sc}50`, isNow: true };
              const idx = mobileLevels.findIndex((l) => l.price < cp!);
              if (idx === -1) mobileLevels.push(nowLevel);
              else mobileLevels.splice(idx, 0, nowLevel);
            }

            return (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "1.2px", fontFamily: "var(--font-mono, monospace)", marginBottom: 8 }}>Price Levels</div>

                {/* Mobile: vertical ladder, high price to low, NOW highlighted in place */}
                <div className="price-rail-mobile">
                  {mobileLevels.map((lvl, i) => (
                    <div key={lvl.key} style={{ display: "flex", alignItems: "center", gap: 8, position: "relative", padding: "5px 0" }}>
                      {i > 0 && <div style={{ position: "absolute", left: 4, top: -3, width: 1, height: 11, background: "var(--border)" }} />}
                      <div style={{
                        width: 9, height: 9, borderRadius: "50%", background: lvl.color, flexShrink: 0,
                        boxShadow: lvl.isNow ? `0 0 6px ${lvl.color}` : undefined,
                      }} />
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, minWidth: 0,
                        background: lvl.isNow ? lvl.bg : "transparent",
                        border: lvl.isNow ? `1px solid ${lvl.border}` : "1px solid transparent",
                        borderRadius: 7, padding: "4px 9px",
                      }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: lvl.isNow ? lvl.color : "#64748b", fontFamily: "var(--font-mono, monospace)" }}>
                          {lvl.isNow ? "● NOW" : lvl.label}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: lvl.color, fontFamily: "var(--font-mono, monospace)" }}>
                          ${lvl.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: horizontal rail, unchanged */}
                <div className="price-rail-desktop" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>

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

          {/* Validator section — open trades only */}
          {trade.status === "open" && (
            validatorResult && validationGeneratedAt
              ? <ValidatorSection result={validatorResult} generatedAt={validationGeneratedAt} />
              : (
                <div style={{ marginBottom: 14, borderRadius: 9, border: "1px solid #1e293b", background: "#0d1424", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "1.2px", fontFamily: "var(--font-mono, monospace)" }}>Validator</span>
                  <span style={{ fontSize: 11, color: "#334155", fontFamily: "var(--font-mono, monospace)" }}>
                    {th
                      ? "ยังไม่มีผลตรวจ — กด \"สแกนเทรด\" ด้านบนเพื่อให้ AI ตรวจแผน"
                      : "No results yet — hit \"Scan Trades\" above for an AI plan check"}
                  </span>
                </div>
              )
          )}

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
                      <span style={{ color: "#475569" }}>{fmtShares(ex.shares)} sh</span>
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
              onSubmit={(exit) => { setShowExitForm(false); onAddExit(exit); }}
              onCancel={() => setShowExitForm(false)}
            />
          )}

          {/* Actions */}
          <div className="trade-actions-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
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

// ── Simple alert modal (replaces window.alert for in-app validation/errors) ──

function SimpleAlertModal({
  th,
  title,
  message,
  onDismiss,
}: {
  th: boolean;
  title?: string;
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="simple-alert-title"
      aria-describedby="simple-alert-desc"
      onClick={onDismiss}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        background: "rgba(6, 10, 18, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(380px, 100%)",
          borderRadius: 14,
          padding: "20px 20px 16px",
          background: "linear-gradient(160deg, rgba(46, 26, 26, 0.98), rgba(15, 17, 23, 0.99))",
          border: "1px solid rgba(239, 68, 68, 0.35)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(239,68,68,0.06) inset",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)",
            fontSize: 18,
          }}>
            ⚠️
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              id="simple-alert-title"
              style={{
                fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 4,
                fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.2px",
              }}
            >
              {title ?? (th ? "บันทึกเทรดไม่ได้" : "Can't save trade")}
            </div>
            <div
              id="simple-alert-desc"
              style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55, fontFamily: "var(--font-mono, monospace)" }}
            >
              {message}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            autoFocus
            onClick={onDismiss}
            style={{
              padding: "8px 18px", borderRadius: 8, cursor: "pointer",
              border: "1px solid var(--border)", background: "transparent", color: "var(--text)",
              fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono, monospace)",
            }}
          >
            {th ? "ปิด" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── No trades — scan blocked modal ────────────────────────────────────────────

function NoTradesScanModal({
  th,
  reason,
  onCancel,
  onAddTrade,
}: {
  th: boolean;
  reason: "empty" | "no-open";
  onCancel: () => void;
  onAddTrade: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="no-trades-scan-title"
      aria-describedby="no-trades-scan-desc"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        background: "rgba(6, 10, 18, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(400px, 100%)",
          borderRadius: 14,
          padding: "22px 22px 18px",
          background: "linear-gradient(160deg, rgba(30, 22, 46, 0.98), rgba(15, 17, 23, 0.99))",
          border: "1px solid rgba(139, 92, 246, 0.35)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.06) inset",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(139, 92, 246, 0.12)", border: "1px solid rgba(139, 92, 246, 0.3)",
            fontSize: 20,
          }}>
            📒
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              id="no-trades-scan-title"
              style={{
                fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 4,
                fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.3px",
              }}
            >
              {reason === "empty"
                ? (th ? "เพิ่มเทรดก่อนสแกน" : "Add a trade first")
                : (th ? "ไม่มีเทรดที่เปิดอยู่" : "No open trades to scan")}
            </div>
            <div
              id="no-trades-scan-desc"
              style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55, fontFamily: "var(--font-mono, monospace)" }}
            >
              {reason === "empty"
                ? (th
                  ? "ยังไม่มีเทรดใน journal — กด Log Trade เพื่อบันทึกแผนก่อน แล้วค่อยใช้ Scan Trades ตรวจแผนด้วย AI"
                  : "Your journal is empty — log a trade plan first, then use Scan Trades for an AI plan check.")
                : (th
                  ? "Scan Trades ตรวจเฉพาะเทรดที่ status เปิดอยู่ — ลอง Log Trade ใหม่หรือเปิด position ที่ปิดไปแล้ว"
                  : "Scan Trades checks open positions only — log a new trade or reopen a closed position.")}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "9px 18px", borderRadius: 8, cursor: "pointer",
              border: "1px solid var(--border)", background: "transparent", color: "var(--muted)",
              fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono, monospace)",
            }}
          >
            {th ? "ปิด" : "Close"}
          </button>
          <button
            type="button"
            onClick={onAddTrade}
            style={{
              padding: "9px 18px", borderRadius: 8, border: "none",
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff", fontSize: 12, fontWeight: 800,
              cursor: "pointer", fontFamily: "var(--font-mono, monospace)",
              boxShadow: "0 4px 14px rgba(16,185,129,0.35)",
            }}
          >
            {th ? "+ บันทึกเทรด" : "+ Log Trade"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Scan quota exhausted modal ────────────────────────────────────────────────

const SCAN_QUOTA_ADMIN_EMAIL = "nitipon.ching@gmail.com";

function ScanQuotaExhaustedModal({
  th,
  limit,
  onDismiss,
}: {
  th: boolean;
  limit: number;
  onDismiss: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="scan-quota-title"
      aria-describedby="scan-quota-desc"
      onClick={onDismiss}
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        background: "rgba(6, 10, 18, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 100%)",
          borderRadius: 14,
          padding: "22px 22px 18px",
          background: "linear-gradient(160deg, rgba(40, 28, 20, 0.98), rgba(15, 17, 23, 0.99))",
          border: "1px solid rgba(245, 158, 11, 0.4)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.08) inset",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.35)",
            fontSize: 20,
          }}>
            ⏳
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              id="scan-quota-title"
              style={{
                fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 4,
                fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.3px",
              }}
            >
              {th ? "ใช้โควต้าสแกนครบแล้ว" : "Scan quota used up"}
            </div>
            <div
              id="scan-quota-desc"
              style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55, fontFamily: "var(--font-mono, monospace)" }}
            >
              {th
                ? `ใช้โควต้า AI Scan ครบ ${limit} ครั้งแล้ว — ติดต่อ admin เพื่อ reset Scan Trades`
                : `You've used all ${limit} AI scans — contact the admin to reset your Scan Trades quota.`}
            </div>
          </div>
        </div>

        <div style={{
          marginBottom: 18, padding: "12px 14px", borderRadius: 10,
          background: "rgba(0,0,0,0.25)", border: "1px solid var(--border)",
        }}>
          <div style={{
            fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase",
            letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)", marginBottom: 8,
          }}>
            {th ? "ติดต่อ admin" : "Contact admin"}
          </div>
          <a
            href={`mailto:${SCAN_QUOTA_ADMIN_EMAIL}?subject=${encodeURIComponent("Stock Playbook — Reset Scan Trades quota")}`}
            style={{
              fontSize: 13, fontWeight: 700, color: "#fbbf24",
              fontFamily: "var(--font-mono, monospace)", textDecoration: "none",
              wordBreak: "break-all",
            }}
          >
            {SCAN_QUOTA_ADMIN_EMAIL}
          </a>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              padding: "9px 18px", borderRadius: 8, cursor: "pointer",
              border: "1px solid var(--border)", background: "transparent", color: "var(--muted)",
              fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono, monospace)",
            }}
          >
            {th ? "ปิด" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Scan success modal ────────────────────────────────────────────────────────

function ScanSuccessModal({
  th,
  scanned,
  remaining,
  onDismiss,
}: {
  th: boolean;
  scanned: number;
  remaining: number;
  onDismiss: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="scan-success-title"
      aria-describedby="scan-success-desc"
      onClick={onDismiss}
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        background: "rgba(6, 10, 18, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 100%)",
          borderRadius: 14,
          padding: "22px 22px 18px",
          background: "linear-gradient(160deg, rgba(16, 40, 32, 0.98), rgba(15, 17, 23, 0.99))",
          border: "1px solid rgba(16, 185, 129, 0.4)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.08) inset",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.35)",
            fontSize: 20, color: "#6ee7b7",
          }}>
            ✓
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              id="scan-success-title"
              style={{
                fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 4,
                fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.3px",
              }}
            >
              {th ? "สแกนเสร็จแล้ว" : "Scan complete"}
            </div>
            <div
              id="scan-success-desc"
              style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55, fontFamily: "var(--font-mono, monospace)" }}
            >
              {th
                ? `AI ตรวจแผน ${scanned} เทรดที่เปิดอยู่แล้ว — กด expand แต่ละหุ้นด้านล่างเพื่อดูผล Validator (HOLD / WATCH / CUT)`
                : `AI checked ${scanned} open ${scanned === 1 ? "trade" : "trades"} — expand each stock below to see the Validator verdict (HOLD / WATCH / CUT).`}
            </div>
          </div>
        </div>

        <div style={{
          marginBottom: 18, padding: "10px 14px", borderRadius: 10,
          background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)",
          fontSize: 11, color: "#6ee7b7", fontFamily: "var(--font-mono, monospace)", fontWeight: 700,
        }}>
          {th
            ? `เหลือสแกน AI อีก ${remaining} ครั้ง`
            : `${remaining} AI scan${remaining === 1 ? "" : "s"} remaining`}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              padding: "9px 18px", borderRadius: 8, border: "none",
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff", fontSize: 12, fontWeight: 800,
              cursor: "pointer", fontFamily: "var(--font-mono, monospace)",
              boxShadow: "0 4px 14px rgba(16,185,129,0.35)",
            }}
          >
            {th ? "ดูผลลัพธ์" : "View results"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteConfirmModal({
  trade,
  th,
  deleting,
  onCancel,
  onConfirm,
}: {
  trade: Trade;
  th: boolean;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [deleting, onCancel]);

  const entryStr = trade.entryDate.slice(0, 10);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-trade-title"
      aria-describedby="delete-trade-desc"
      onClick={() => { if (!deleting) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        background: "rgba(6, 10, 18, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(400px, 100%)",
          borderRadius: 14,
          padding: "22px 22px 18px",
          background: "linear-gradient(160deg, rgba(30, 22, 28, 0.98), rgba(15, 17, 23, 0.99))",
          border: "1px solid rgba(239, 68, 68, 0.35)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(239,68,68,0.06) inset",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)",
            fontSize: 20,
          }}>
            🗑
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              id="delete-trade-title"
              style={{
                fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 4,
                fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.3px",
              }}
            >
              {th ? "ลบเทรดนี้?" : "Delete this trade?"}
            </div>
            <div
              id="delete-trade-desc"
              style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55, fontFamily: "var(--font-mono, monospace)" }}
            >
              {th
                ? "การลบไม่สามารถย้อนกลับได้ — ข้อมูล exits และ AI validation ของเทรดนี้จะหายไป"
                : "This cannot be undone — exits and AI validation for this trade will be removed."}
            </div>
          </div>
        </div>

        <div style={{
          marginBottom: 18, padding: "12px 14px", borderRadius: 10,
          background: "rgba(0,0,0,0.25)", border: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#f87171", fontFamily: "var(--font-mono, monospace)", marginBottom: 6 }}>
            {trade.ticker}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
            <span>{th ? "เข้า" : "Entry"} ${trade.entryPrice.toFixed(2)}</span>
            <span>{trade.shares} {th ? "หุ้น" : "shares"}</span>
            <span>{entryStr}</span>
            <span style={{
              padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700,
              background: trade.status === "open" ? "#f59e0b18" : "#64748b18",
              color: trade.status === "open" ? "#f59e0b" : "#94a3b8",
              border: `1px solid ${trade.status === "open" ? "#f59e0b35" : "#64748b35"}`,
            }}>
              {trade.status.toUpperCase()}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            style={{
              padding: "9px 18px", borderRadius: 8, cursor: deleting ? "not-allowed" : "pointer",
              border: "1px solid var(--border)", background: "transparent", color: "var(--muted)",
              fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono, monospace)",
              opacity: deleting ? 0.5 : 1,
            }}
          >
            {th ? "ยกเลิก" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            style={{
              padding: "9px 18px", borderRadius: 8, border: "none",
              background: deleting ? "#7f1d1d" : "linear-gradient(135deg, #ef4444, #dc2626)",
              color: "#fff", fontSize: 12, fontWeight: 800,
              cursor: deleting ? "wait" : "pointer",
              fontFamily: "var(--font-mono, monospace)",
              boxShadow: deleting ? "none" : "0 4px 14px rgba(239,68,68,0.35)",
              minWidth: 100,
            }}
          >
            {deleting ? (th ? "กำลังลบ…" : "Deleting…") : (th ? "ลบเทรด" : "Delete trade")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI Validate overlay ───────────────────────────────────────────────────────

function ValidateJournalOverlay({ th, openCount }: { th: boolean; openCount: number }) {
  const steps = th
    ? ["ดึงราคาล่าสุด…", "วิเคราะห์แผนเทรด…", "AI กำลังตรวจ journal…"]
    : ["Fetching live prices…", "Analyzing trade plans…", "AI validating journal…"];

  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStepIdx((i) => (i + 1) % steps.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [steps.length]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={th ? "กำลังตรวจ journal ด้วย AI" : "AI journal validation in progress"}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        background: "rgba(6, 10, 18, 0.82)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div style={{
        width: "min(420px, 100%)",
        borderRadius: 16,
        padding: "28px 24px 24px",
        background: "linear-gradient(145deg, rgba(30, 27, 46, 0.95), rgba(15, 17, 23, 0.98))",
        border: "1px solid rgba(139, 92, 246, 0.35)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(139,92,246,0.08) inset",
        textAlign: "center",
      }}>
        {/* Radar spinner */}
        <div style={{ position: "relative", width: 88, height: 88, margin: "0 auto 20px" }}>
          <div className="vj-radar-ring" aria-hidden />
          <div className="vj-radar-ring vj-radar-ring-2" aria-hidden />
          <svg width={88} height={88} viewBox="0 0 88 88" aria-hidden style={{ position: "relative", zIndex: 1 }}>
            <circle cx="44" cy="44" r="32" fill="none" stroke="rgba(139,92,246,0.2)" strokeWidth="1.5" />
            <circle cx="44" cy="44" r="20" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="1" />
            <g className="vj-radar-sweep" style={{ transformOrigin: "44px 44px" }}>
              <line x1="44" y1="44" x2="44" y2="14" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" />
            </g>
            <circle cx="44" cy="44" r="4" fill="#8b5cf6" />
            <circle cx="58" cy="30" r="3" fill="#c4b5fd" className="vj-radar-blip" />
          </svg>
        </div>

        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase",
          color: "#a78bfa", marginBottom: 8, fontFamily: "var(--font-mono, monospace)",
        }}>
          🤖 {th ? "สแกนเทรด · AI" : "Scan Trades · AI"}
        </div>

        <div style={{
          fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6,
          fontFamily: "var(--font-display, sans-serif)",
        }}>
          {th ? "กำลังตรวจเทรดของคุณ…" : "Validating your trades…"}
        </div>

        <div style={{
          fontSize: 12, color: "var(--muted)", marginBottom: 18, lineHeight: 1.5,
          fontFamily: "var(--font-mono, monospace)", minHeight: 36,
        }}>
          {steps[stepIdx]}
          <span className="vj-dots" aria-hidden />
          <br />
          <span style={{ fontSize: 10, opacity: 0.75 }}>
            {openCount} {th ? "ตำแหน่งเปิด" : "open position"}{openCount !== 1 ? (th ? "" : "s") : ""}
            {" · "}
            {th ? "โปรดรอ 15–40 วินาที" : "usually 15–40 seconds"}
          </span>
        </div>

        <div style={{
          height: 3, borderRadius: 99, background: "rgba(139,92,246,0.15)", overflow: "hidden", marginBottom: 14,
        }}>
          <div className="vj-progress-bar" />
        </div>

        <div style={{ fontSize: 10, color: "#475569", fontFamily: "var(--font-mono, monospace)" }}>
          {th ? "อย่ากดปุ่มอื่น — กำลังประมวลผล" : "Please wait — do not click other actions"}
        </div>
      </div>

      <style>{`
        .vj-radar-ring {
          position: absolute; inset: 0; border-radius: 50%;
          border: 1px solid rgba(139, 92, 246, 0.35);
          animation: vjPulseRing 2.4s ease-out infinite;
        }
        .vj-radar-ring-2 { animation-delay: 1.2s; }
        .vj-radar-sweep {
          animation: vjRadarSweep 1.8s linear infinite;
        }
        .vj-radar-blip {
          animation: vjBlip 1.8s ease-in-out infinite;
        }
        .vj-progress-bar {
          height: 100%; width: 40%; border-radius: 99px;
          background: linear-gradient(90deg, #8b5cf6, #c4b5fd, #8b5cf6);
          background-size: 200% 100%;
          animation: vjProgress 1.6s ease-in-out infinite;
        }
        .vj-dots::after {
          content: "";
          animation: vjDots 1.4s steps(4, end) infinite;
        }
        @keyframes vjRadarSweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes vjPulseRing {
          0% { transform: scale(0.85); opacity: 0.9; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes vjBlip {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
        @keyframes vjProgress {
          0% { transform: translateX(-120%); background-position: 0% 50%; }
          100% { transform: translateX(320%); background-position: 100% 50%; }
        }
        @keyframes vjDots {
          0% { content: ""; }
          25% { content: "."; }
          50% { content: ".."; }
          75% { content: "..."; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vj-radar-sweep, .vj-radar-ring, .vj-radar-blip, .vj-progress-bar { animation: none !important; }
        }
      `}</style>
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

export function JournalContent({ initialTrades, stats, reportOptions = [], priceMap = {}, reportsByTicker = {}, quota = null }: {
  initialTrades: Trade[];
  stats: JournalStats;
  reportOptions?: ReportOption[];
  priceMap?: Record<string, PriceInfo>;
  reportsByTicker?: Record<string, ReportDateOption[]>;
  quota?: AiValidateQuota | null;
}) {
  const { lang } = useLang();
  const th = lang === "th";
  const [trades, setTrades] = useState<Trade[]>(initialTrades);
  const [showForm, setShowForm] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "closed">("open");
  const [filterType, setFilterType] = useState<string>("all");
  const [livePriceMap, setLivePriceMap] = useState<Record<string, PriceInfo>>(priceMap);
  const [priceStatus, setPriceStatus] = useState<"loading" | "live" | "error" | "idle">("idle");
  const [quotaState, setQuotaState] = useState<AiValidateQuota | null>(quota);
  const [validating, setValidating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Trade | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showNoTradesModal, setShowNoTradesModal] = useState(false);
  const [scanBlockReason, setScanBlockReason] = useState<"empty" | "no-open">("empty");
  const [scanSuccess, setScanSuccess] = useState<{ scanned: number; remaining: number; tradeIds: string[] } | null>(null);
  const [expandedTradeIds, setExpandedTradeIds] = useState<Set<string>>(new Set());
  const [showQuotaExhaustedModal, setShowQuotaExhaustedModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Scroll the Log/Edit Trade form into view whenever it opens.
  useEffect(() => {
    if ((showForm || editTrade) && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showForm, editTrade]);

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
    if (!trade.ticker.trim()) {
      setSaveError(th ? "กรุณาใส่ ticker ก่อนบันทึก" : "Please enter a ticker before saving.");
      return;
    }
    if (trade.shares <= 0) {
      setSaveError(th ? "กรุณาใส่จำนวนหุ้นให้มากกว่า 0" : "Please enter a share amount greater than 0.");
      return;
    }
    const isNew = !trades.some((t) => t.id === trade.id);
    try {
      const saved = isNew ? await apiCreate(trade) : await apiUpdate(trade);
      setTrades((prev) => {
        const idx = prev.findIndex((t) => t.id === saved.id);
        return idx >= 0 ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved];
      });
      setShowForm(false);
      setEditTrade(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : (th ? "บันทึกเทรดไม่สำเร็จ" : "Failed to save trade"));
    }
  }, [trades, th]);

  const handleAddExit = useCallback(async (tradeId: string, exit: TradeExit) => {
    try {
      const updated = await apiAddExit(tradeId, exit);
      setTrades((prev) => prev.map((t) => (t.id === tradeId ? updated : t)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to log exit");
    }
  }, []);

  const handleValidate = useCallback(async () => {
    setValidating(true);
    try {
      const res = await fetch("/api/journal/journal/validate", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setQuotaState((prev) => (prev ? { ...prev, remaining: 0 } : prev));
          setShowQuotaExhaustedModal(true);
          return;
        }
        if (res.status === 400 && body.message === "No open trades to validate") {
          setScanBlockReason("no-open");
          setShowNoTradesModal(true);
          return;
        }
        throw new Error(body.message ?? `Validate failed (${res.status})`);
      }
      const data: { results: (ValidatorResult & { tradeId: string; validatedAt: string })[]; remaining: number } =
        await res.json();
      setTrades((prev) =>
        prev.map((t) => {
          const match = data.results.find((r) => r.tradeId === t.id);
          return match ? { ...t, validation: match } : t;
        }),
      );
      setQuotaState((prev) => (prev ? { ...prev, remaining: data.remaining, used: prev.limit - data.remaining } : prev));
      setScanSuccess({ scanned: data.results.length, remaining: data.remaining, tradeIds: data.results.map((r) => r.tradeId) });
    } catch (err) {
      alert(err instanceof Error ? err.message : "AI validate failed");
    } finally {
      setValidating(false);
    }
  }, [th]);

  const handleScanClick = useCallback(() => {
    if (quotaState && quotaState.remaining <= 0) {
      setShowQuotaExhaustedModal(true);
      return;
    }
    const openCount = trades.filter((t) => t.status === "open").length;
    if (trades.length === 0) {
      setScanBlockReason("empty");
      setShowNoTradesModal(true);
      return;
    }
    if (openCount === 0) {
      setScanBlockReason("no-open");
      setShowNoTradesModal(true);
      return;
    }
    void handleValidate();
  }, [trades, handleValidate, quotaState]);

  const dismissScanSuccess = useCallback(() => {
    if (scanSuccess) {
      setExpandedTradeIds((prev) => new Set([...prev, ...scanSuccess.tradeIds]));
    }
    setScanSuccess(null);
    const el = document.getElementById("journal-trade-list");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [scanSuccess]);

  const openLogTradeForm = useCallback(() => {
    setShowNoTradesModal(false);
    setShowForm(true);
    setEditTrade(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const requestDelete = useCallback((trade: Trade) => {
    setDeleteTarget(trade);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await apiDelete(deleteTarget.id);
      setTrades((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete trade");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleting]);

  const cancelDelete = useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
  }, [deleting]);

  const filtered = trades.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterType !== "all" && t.catalystType !== filterType) return false;
    return true;
  });

  const allTypes = Array.from(new Set(trades.map((t) => t.catalystType)));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {validating && (
        <ValidateJournalOverlay
          th={th}
          openCount={trades.filter((t) => t.status === "open").length}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          trade={deleteTarget}
          th={th}
          deleting={deleting}
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
        />
      )}
      {showNoTradesModal && (
        <NoTradesScanModal
          th={th}
          reason={scanBlockReason}
          onCancel={() => setShowNoTradesModal(false)}
          onAddTrade={openLogTradeForm}
        />
      )}
      {scanSuccess && (
        <ScanSuccessModal
          th={th}
          scanned={scanSuccess.scanned}
          remaining={scanSuccess.remaining}
          onDismiss={dismissScanSuccess}
        />
      )}
      {showQuotaExhaustedModal && quotaState && (
        <ScanQuotaExhaustedModal
          th={th}
          limit={quotaState.limit}
          onDismiss={() => setShowQuotaExhaustedModal(false)}
        />
      )}
      {saveError && (
        <SimpleAlertModal
          th={th}
          message={saveError}
          onDismiss={() => setSaveError(null)}
        />
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(1.2); }
        }
        @keyframes jvFieldReveal {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .jv-field-reveal { animation: jvFieldReveal 0.25s ease-out; }
        .price-rail-mobile { display: none; }
        @media (max-width: 640px) {
          .trade-stats-row {
            width: 100%;
            justify-content: space-between;
            margin-top: 6px;
          }
          .trade-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .price-rail-desktop { display: none !important; }
          .price-rail-mobile {
            display: flex;
            flex-direction: column;
          }
          .trade-actions-row {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr);
          }
          .trade-actions-row > button { width: 100%; }
          .jv-validate-btn { padding: 8px 12px !important; }
          .jv-validate-sub { display: none !important; }
        }
        .jv-validate-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 9px 14px 9px 12px;
          border-radius: 10px;
          border: 2px solid transparent;
          background:
            linear-gradient(135deg, rgba(36, 24, 58, 0.98), rgba(15, 17, 23, 0.99)) padding-box,
            linear-gradient(
              90deg,
              #6d28d9,
              #a78bfa,
              #e9d5ff,
              #6366f1,
              #c084fc,
              #7c3aed,
              #6d28d9
            ) border-box;
          background-size: auto, 300% 100%;
          color: #f3e8ff;
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
          user-select: none;
          font-family: var(--font-mono, monospace);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.06) inset,
            0 4px 16px rgba(139, 92, 246, 0.22);
          transition:
            transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1),
            box-shadow 0.18s ease,
            background 0.18s ease;
          overflow: hidden;
          isolation: isolate;
        }
        .jv-validate-btn:not(:disabled) {
          animation: jvIdleGlow 3s ease-in-out infinite, jvBorderFlow 2.8s linear infinite;
        }
        .jv-validate-btn:not(:disabled)::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            105deg,
            transparent 38%,
            rgba(255, 255, 255, 0.14) 50%,
            transparent 62%
          );
          transform: translateX(-130%);
          transition: transform 0.65s ease;
          pointer-events: none;
          z-index: 0;
        }
        .jv-validate-btn:not(:disabled):hover::before {
          transform: translateX(130%);
        }
        .jv-validate-btn:not(:disabled):hover {
          transform: translateY(-2px) scale(1.02);
          background:
            linear-gradient(135deg, rgba(55, 32, 88, 0.98), rgba(20, 18, 35, 0.99)) padding-box,
            linear-gradient(
              90deg,
              #8b5cf6,
              #ddd6fe,
              #818cf8,
              #e9d5ff,
              #a78bfa,
              #8b5cf6
            ) border-box;
          background-size: auto, 300% 100%;
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.1) inset,
            0 10px 32px rgba(139, 92, 246, 0.42),
            0 0 28px rgba(139, 92, 246, 0.2);
          animation: jvBorderFlow 1.4s linear infinite;
        }
        .jv-validate-btn:not(:disabled):active {
          transform: translateY(0) scale(0.98);
          box-shadow:
            0 0 0 1px rgba(139, 92, 246, 0.15) inset,
            0 2px 8px rgba(139, 92, 246, 0.25);
          transition-duration: 0.08s;
        }
        .jv-validate-btn:focus-visible {
          outline: 2px solid #c4b5fd;
          outline-offset: 3px;
        }
        .jv-validate-btn:disabled {
          cursor: not-allowed;
          opacity: 0.45;
          box-shadow: none;
          animation: none;
          border: 1px solid rgba(100, 116, 139, 0.25);
          background: rgba(30, 41, 59, 0.3);
        }
        .jv-validate-btn:disabled::before {
          display: none;
        }
        .jv-validate-btn > * {
          position: relative;
          z-index: 1;
        }
        @keyframes jvBorderFlow {
          0% { background-position: 0 0, 0% 0; }
          100% { background-position: 0 0, 300% 0; }
        }
        @keyframes jvIdleGlow {
          0%, 100% {
            box-shadow:
              0 1px 0 rgba(255, 255, 255, 0.05) inset,
              0 0 0 1px rgba(139, 92, 246, 0.08) inset,
              0 4px 16px rgba(139, 92, 246, 0.2);
          }
          50% {
            box-shadow:
              0 1px 0 rgba(255, 255, 255, 0.07) inset,
              0 0 0 1px rgba(167, 139, 250, 0.15) inset,
              0 6px 22px rgba(139, 92, 246, 0.32);
          }
        }
        .jv-validate-icon {
          width: 26px;
          height: 26px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          background: linear-gradient(145deg, #a78bfa, #7c3aed);
          color: #fff;
          box-shadow: 0 2px 10px rgba(139, 92, 246, 0.5);
          flex-shrink: 0;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .jv-validate-btn:not(:disabled):hover .jv-validate-icon {
          transform: scale(1.08) rotate(-8deg);
          box-shadow: 0 4px 14px rgba(167, 139, 250, 0.65);
        }
        .jv-validate-btn:not(:disabled):active .jv-validate-icon {
          transform: scale(0.95);
        }
        .jv-validate-sub {
          display: block;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.4px;
          color: rgba(196, 181, 253, 0.75);
          margin-top: 1px;
        }
        .jv-quota-pill {
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(15, 17, 23, 0.55);
          border: 1px solid rgba(167, 139, 250, 0.25);
          color: #c4b5fd;
          letter-spacing: 0.3px;
          transition: background 0.18s ease, border-color 0.18s ease;
        }
        .jv-quota-pill--empty {
          background: rgba(245, 158, 11, 0.12);
          border-color: rgba(245, 158, 11, 0.45);
          color: #fbbf24;
        }
        .jv-validate-btn:not(:disabled):hover .jv-quota-pill {
          background: rgba(15, 17, 23, 0.75);
          border-color: rgba(196, 181, 253, 0.45);
        }
        @media (prefers-reduced-motion: reduce) {
          .jv-validate-btn:not(:disabled) {
            animation: jvIdleGlow 3s ease-in-out infinite;
          }
          .jv-validate-btn:not(:disabled)::before { display: none; }
        }
      `}</style>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>{th ? "← หน้าหลัก" : "← Home"}</Link>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {quotaState && (
            <button
              type="button"
              className={`jv-validate-btn${quotaState.remaining <= 0 ? " jv-validate-btn--quota-empty" : ""}`}
              onClick={handleScanClick}
              disabled={validating}
              title={
                quotaState.remaining <= 0
                  ? (th ? "โควต้าหมด — ติดต่อ admin เพื่อ reset" : "Quota used — contact admin to reset")
                  : (th ? "AI ตรวจแผนเทรดที่เปิดอยู่ทั้งหมด" : "AI checks all open trade plans")
              }
            >
              <span className="jv-validate-icon" aria-hidden>{validating ? "⟳" : "✦"}</span>
              <span style={{ textAlign: "left", lineHeight: 1.2 }}>
                <span style={{ display: "block", letterSpacing: "0.2px" }}>
                  {validating
                    ? (th ? "กำลังสแกน…" : "Scanning…")
                    : (th ? "สแกนเทรด" : "Scan Trades")}
                </span>
                {!validating && (
                  <span className="jv-validate-sub">
                    {th ? "ตรวจแผน · AI" : "AI plan check"}
                  </span>
                )}
              </span>
              <span className={`jv-quota-pill${quotaState.remaining <= 0 ? " jv-quota-pill--empty" : ""}`}>{quotaState.remaining}/{quotaState.limit}</span>
            </button>
          )}
          <button
            onClick={() => { setShowForm(true); setEditTrade(null); }}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}
          >
            + Log Trade
          </button>
        </div>
      </div>

      <h1 style={{ fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 900, margin: "0 0 4px", letterSpacing: "-0.5px", fontFamily: "var(--font-display, sans-serif)" }}>
        Trade Journal
      </h1>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 24px", fontFamily: "var(--font-mono, monospace)" }}>
        {trades.length} trades
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
                  <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{fmtTradeCount(data.trades)}</span>
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
        <div ref={formRef} style={{ marginBottom: 20, scrollMarginTop: 16 }}>
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
      <div id="journal-trade-list">
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
              validatorResult={trade.validation ?? undefined}
              validationGeneratedAt={trade.validation?.validatedAt}
              expanded={expandedTradeIds.has(trade.id)}
              onToggleExpand={() => setExpandedTradeIds((prev) => {
                const next = new Set(prev);
                if (next.has(trade.id)) next.delete(trade.id); else next.add(trade.id);
                return next;
              })}
              onEdit={() => { setEditTrade(trade); setShowForm(false); }}
              onDelete={() => requestDelete(trade)}
              onAddExit={(exit) => handleAddExit(trade.id, exit)}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
