"use client";

import { useState, useCallback } from "react";
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

function TradeForm({ initial, reportOptions, onSave, onCancel }: {
  initial?: Trade;
  reportOptions: ReportOption[];
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

  function handleTickerSelect(ticker: string) {
    if (ticker === "__other__") {
      setCustomTicker(true);
      field("ticker", "");
      return;
    }
    setCustomTicker(false);
    const r = reportOptions.find((o) => o.ticker === ticker);
    if (!r) { field("ticker", ticker); return; }
    // Auto-fill from report
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
        <Field label="Report Date (YYYYMMDD)">
          <input style={inputStyle} value={t.linkedReportDate ?? todayYYYYMMDD()} onChange={(e) => field("linkedReportDate", e.target.value)} placeholder={todayYYYYMMDD()} />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          style={{ ...inputStyle, resize: "vertical", minHeight: 56 }}
          value={t.notes ?? ""}
          onChange={(e) => field("notes", e.target.value)}
          placeholder="Thesis, market conditions, deviations from plan..."
        />
      </Field>

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

function TradeRow({ trade, onEdit, onDelete, onSaveExit }: {
  trade: Trade;
  onEdit: () => void;
  onDelete: () => void;
  onSaveExit: (updated: Trade) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showExitForm, setShowExitForm] = useState(false);

  const pnl = trade.status === "closed"
    ? (trade.realizedPnL ?? calcPnL(trade))
    : null;
  const cost = trade.entryPrice * trade.shares;
  const pnlPct = pnl !== null && cost > 0 ? (pnl / cost * 100) : null;
  const days = holdDays(trade);
  const tp1 = trade.plannedTP[0];
  const adherent = trade.status === "closed" && trade.exits.length > 0 && tp1 > 0
    ? trade.exits.reduce((s, e) => s + e.price * e.shares, 0) / trade.exits.reduce((s, e) => s + e.shares, 0) >= tp1
    : null;

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
      {/* Summary row */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer", background: "var(--card)" }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Ticker + status */}
        <div style={{ minWidth: 80 }}>
          <Link href={`/report/${trade.ticker.toLowerCase()}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none" }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>{trade.ticker}</span>
          </Link>
          <div>
            <span style={{
              fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 4,
              background: trade.status === "open" ? "#10b98118" : "#64748b18",
              color: trade.status === "open" ? "#10b981" : "#64748b",
              border: `1px solid ${trade.status === "open" ? "#10b98130" : "#64748b30"}`,
              fontFamily: "var(--font-mono, monospace)",
            }}>{trade.status.toUpperCase()}</span>
          </div>
        </div>

        {/* Catalyst type */}
        <div style={{ flex: 1, fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
          {trade.catalystType.replace(/_/g, " ")}
        </div>

        {/* Entry */}
        <div style={{ textAlign: "right", minWidth: 70 }}>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>${trade.entryPrice.toFixed(2)}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{trade.shares} sh</div>
        </div>

        {/* P&L */}
        <div style={{ textAlign: "right", minWidth: 80 }}>
          {pnl !== null ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 800, color: pnlColor(pnl), fontFamily: "var(--font-mono, monospace)" }}>{fmt$(pnl)}</div>
              {pnlPct !== null && <div style={{ fontSize: 10, color: pnlColor(pnl), fontFamily: "var(--font-mono, monospace)" }}>{fmtPct(pnlPct)}</div>}
            </>
          ) : (
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>open</span>
          )}
        </div>

        {/* Days */}
        <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", minWidth: 36, textAlign: "right" }}>
          {days}d
        </div>

        {/* Plan adherence */}
        {adherent !== null && (
          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: adherent ? "#10b98118" : "#ef444418", color: adherent ? "#10b981" : "#ef4444", fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>
            {adherent ? "✓ plan" : "✗ plan"}
          </span>
        )}

        {/* Expand arrow */}
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "14px 16px", background: "var(--card-elevated, #0f172a)", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono, monospace)", color: "var(--muted)" }}>
              Entry <strong style={{ color: "var(--text)" }}>{trade.entryDate}</strong>
            </div>
            {trade.plannedTP[0] > 0 && <div style={{ fontSize: 11, fontFamily: "var(--font-mono, monospace)", color: "#10b981" }}>TP1 <strong>${trade.plannedTP[0]}</strong></div>}
            {trade.plannedTP[1] > 0 && <div style={{ fontSize: 11, fontFamily: "var(--font-mono, monospace)", color: "#10b981" }}>TP2 <strong>${trade.plannedTP[1]}</strong></div>}
            {trade.plannedTP[2] > 0 && <div style={{ fontSize: 11, fontFamily: "var(--font-mono, monospace)", color: "#10b981" }}>TP3 <strong>${trade.plannedTP[2]}</strong></div>}
            {trade.plannedSL > 0 && <div style={{ fontSize: 11, fontFamily: "var(--font-mono, monospace)", color: "#ef4444" }}>SL <strong>${trade.plannedSL}</strong></div>}
            {trade.linkedReportDate && (
              <Link href={`/report/${trade.ticker.toLowerCase()}`} style={{ fontSize: 11, color: "#3b82f6", fontFamily: "var(--font-mono, monospace)" }}>
                Report {trade.linkedReportDate} →
              </Link>
            )}
          </div>

          {/* Exits */}
          {trade.exits.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)", marginBottom: 6 }}>Exits</div>
              {trade.exits.map((ex, i) => {
                const exPnl = ex.shares * (ex.price - trade.entryPrice);
                return (
                  <div key={i} style={{ display: "flex", gap: 14, fontSize: 11, fontFamily: "var(--font-mono, monospace)", marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ color: "var(--muted)" }}>{ex.date}</span>
                    <span>${ex.price.toFixed(2)}</span>
                    <span>{ex.shares} sh</span>
                    <span style={{ color: pnlColor(exPnl) }}>{fmt$(exPnl)}</span>
                    {ex.note && <span style={{ color: "var(--muted)", fontStyle: "italic" }}>{ex.note}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes */}
          {trade.notes && (
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-body, sans-serif)", lineHeight: 1.5, marginBottom: 12, fontStyle: "italic" }}>
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {trade.status === "open" && !showExitForm && (
              <button
                onClick={() => setShowExitForm(true)}
                style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #f59e0b40", background: "#f59e0b18", color: "#f59e0b", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}
              >
                Log Exit
              </button>
            )}
            <button
              onClick={onEdit}
              style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 11, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #ef444430", background: "#ef444412", color: "#ef4444", fontSize: 11, cursor: "pointer", fontFamily: "var(--font-mono, monospace)" }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function JournalContent({ initialTrades, stats, reportOptions = [] }: { initialTrades: Trade[]; stats: JournalStats; reportOptions?: ReportOption[] }) {
  const [trades, setTrades] = useState<Trade[]>(initialTrades);
  const [showForm, setShowForm] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "closed">("all");
  const [filterType, setFilterType] = useState<string>("all");

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
      {/* Private badge + header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>← Dashboard</Link>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 6,
            background: "#ef444418", color: "#ef4444", border: "1px solid #ef444430",
            fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.5px",
          }}>
            🔒 PRIVATE — local only
          </span>
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
