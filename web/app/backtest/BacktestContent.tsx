"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { BacktestEntry, BacktestStats, Checkpoint } from "@/lib/backtest";

// ── Constants ─────────────────────────────────────────────────────────────────

const VERDICT_COLORS: Record<string, string> = {
  BUY: "#10b981", HOLD: "#f59e0b", SELL: "#ef4444", SPECULATIVE: "#8b5cf6",
};

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  hit:     { color: "#10b981", label: "✓" },
  miss:    { color: "#ef4444", label: "✗" },
  pending: { color: "#64748b", label: "…" },
  partial: { color: "#f59e0b", label: "~" },
};

function fmtDate(yyyymmdd: string): string {
  const y = yyyymmdd.slice(0, 4);
  const m = parseInt(yyyymmdd.slice(4, 6)) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8));
  return new Date(parseInt(y), m, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

function pctColor(v: number | null, dir: "up" | "down" | "flat"): string {
  if (v === null) return "#64748b";
  if (dir === "up")   return v > 0 ? "#10b981" : "#ef4444";
  if (dir === "down") return v < 0 ? "#10b981" : "#ef4444";
  return Math.abs(v) < 10 ? "#10b981" : "#f59e0b";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CheckpointCell({ cp }: { cp: Checkpoint }) {
  const st = STATUS_STYLES[cp.status];
  const isPending = cp.status === "pending";
  const color = isPending ? "#64748b" : pctColor(cp.actualPct, cp.expectedDir);

  return (
    <td style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "middle" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <span style={{
          fontSize: 11, fontWeight: 800,
          color: isPending ? "#3b82f6" : st.color,
          fontFamily: "var(--font-mono, monospace)",
        }}>
          {isPending
            ? cp.targetDate.slice(0, 7)
            : `${fmtPct(cp.actualPct)}`}
        </span>
        <span style={{
          fontSize: 9, padding: "1px 5px", borderRadius: 4,
          background: isPending ? "#3b82f618" : `${st.color}18`,
          color: isPending ? "#3b82f6" : st.color,
          border: `1px solid ${isPending ? "#3b82f630" : `${st.color}30`}`,
          fontFamily: "var(--font-mono, monospace)", fontWeight: 700,
        }}>
          {isPending ? "PENDING" : st.label + " " + (cp.actualPrice ? `$${cp.actualPrice.toFixed(0)}` : "")}
        </span>
      </div>
    </td>
  );
}

function CalibrationBar({ label, color, avg, hitRate, count }: {
  label: string; color: string;
  avg: number | null; hitRate: number | null; count: number;
}) {
  const barW = avg !== null ? Math.min(Math.abs(avg) / 40 * 100, 100) : 0;
  const isPos = avg === null || avg >= 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ minWidth: 90 }}>
        <span style={{
          fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 5,
          background: `${color}18`, color, border: `1px solid ${color}30`,
          fontFamily: "var(--font-mono, monospace)",
        }}>
          {label}
        </span>
        <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginTop: 3 }}>n={count}</div>
      </div>

      {avg !== null ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${barW}%`,
                background: isPos ? "#10b981" : "#ef4444",
                borderRadius: 4, transition: "width 0.6s ease",
              }} />
            </div>
            <span style={{
              fontSize: 13, fontWeight: 900, minWidth: 56, textAlign: "right",
              color: isPos ? "#10b981" : "#ef4444",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              {fmtPct(avg)}
            </span>
          </div>
          {hitRate !== null && (
            <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
              Hit rate: <strong style={{ color: hitRate >= 0.6 ? "#10b981" : hitRate >= 0.4 ? "#f59e0b" : "#ef4444" }}>
                {(hitRate * 100).toFixed(0)}%
              </strong>
            </div>
          )}
        </div>
      ) : (
        <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", fontStyle: "italic" }}>
          No completed checkpoints yet
        </span>
      )}
    </div>
  );
}

// ── Fetch button ──────────────────────────────────────────────────────────────

function FetchButton({ pendingItems }: {
  pendingItems: Array<{ ticker: string; date: string }>;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [fetched, setFetched] = useState(0);

  const run = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/backtest/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingItems),
      });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json() as { results: Record<string, number | null> };
      const hits = Object.values(data.results).filter((v) => v !== null).length;
      setFetched(hits);
      setStatus("done");
      // Reload to reflect new prices
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setStatus("error");
    }
  }, [pendingItems]);

  if (pendingItems.length === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: "#3b82f618", border: "1px solid #3b82f630" }}>
      <div style={{ fontSize: 12, color: "#3b82f6", fontFamily: "var(--font-mono, monospace)" }}>
        {pendingItems.length} past checkpoint{pendingItems.length !== 1 ? "s" : ""} need price lookup
      </div>
      <button
        onClick={run}
        disabled={status === "loading"}
        style={{
          padding: "6px 14px", borderRadius: 7, border: "none",
          background: "#3b82f6", color: "#fff", fontWeight: 800, fontSize: 12,
          cursor: status === "loading" ? "not-allowed" : "pointer",
          fontFamily: "var(--font-mono, monospace)",
          opacity: status === "loading" ? 0.7 : 1,
        }}
      >
        {status === "idle"    && "Fetch Prices →"}
        {status === "loading" && "Fetching…"}
        {status === "done"    && `✓ ${fetched} prices fetched — reloading`}
        {status === "error"   && "Error — only works locally"}
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function BacktestContent({ entries, stats }: { entries: BacktestEntry[]; stats: BacktestStats }) {
  // Items that are past due but have no cached price yet
  const today = new Date().toISOString().slice(0, 10);
  const pendingFetches = entries.flatMap((e) =>
    e.checkpoints
      .filter((c) => c.status === "pending" && c.targetDate <= today)
      .map((c) => ({ ticker: e.ticker, date: c.targetDate }))
  );

  const verdictOrder = ["BUY", "SPECULATIVE", "HOLD", "SELL"] as const;
  const allPending = stats.completedCheckpoints === 0;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>← Dashboard</Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 900, margin: "0 0 4px", letterSpacing: "-0.5px", fontFamily: "var(--font-display, sans-serif)" }}>
          Verdict Accuracy Backtest
        </h1>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 16px", fontFamily: "var(--font-mono, monospace)" }}>
          {entries.length} report snapshot{entries.length !== 1 ? "s" : ""} · {stats.completedCheckpoints} completed checkpoints · {stats.pendingCheckpoints} pending
        </p>

        {pendingFetches.length > 0 && <FetchButton pendingItems={pendingFetches} />}
      </div>

      {/* Calibration chart */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px", marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: "var(--font-mono, monospace)", marginBottom: 16 }}>
          📊 Calibration — Avg 30d Return by Verdict
        </div>
        {allPending ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)" }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>⏳</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>No completed checkpoints yet</div>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono, monospace)" }}>
              First 30d checkpoint: <strong style={{ color: "#3b82f6" }}>
                {entries.length > 0
                  ? entries.reduce((earliest, e) => {
                      const d = e.checkpoints[0].targetDate;
                      return d < earliest ? d : earliest;
                    }, "9999-99-99")
                  : "—"}
              </strong>
            </div>
          </div>
        ) : (
          <div>
            {verdictOrder.map((v) => {
              const d = stats.byVerdict[v];
              if (!d) return null;
              return (
                <CalibrationBar
                  key={v}
                  label={v}
                  color={VERDICT_COLORS[v]}
                  avg={d.avg30d}
                  hitRate={d.hitRate}
                  count={d.count}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* All checkpoints table */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: "var(--font-mono, monospace)" }}>
            All Checkpoints
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                {["Report Date", "Stock", "Verdict", "Entry Price", "Score", "+30d", "+60d", "+90d"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: h === "Stock" ? "left" : "center", fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => {
                const vc = VERDICT_COLORS[entry.verdict] ?? "#64748b";
                const baseBg = idx % 2 === 0 ? "transparent" : "#ffffff04";
                return (
                  <tr key={`${entry.ticker}-${entry.reportDate}`} style={{ background: baseBg, borderBottom: idx < entries.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "10px 12px", textAlign: "center", color: "var(--muted)", fontSize: 11, whiteSpace: "nowrap" }}>
                      {fmtDate(entry.reportDate)}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <Link href={`/report/${entry.ticker.toLowerCase()}`} style={{ textDecoration: "none" }}>
                        <span style={{ fontWeight: 800, color: vc, textDecoration: "underline", textDecorationColor: vc + "55", textUnderlineOffset: 3 }}>
                          {entry.ticker}
                        </span>
                      </Link>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{entry.companyName.split(" ").slice(0, 2).join(" ")}</div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: `${vc}18`, color: vc, border: `1px solid ${vc}30` }}>
                        {entry.verdict}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700 }}>
                      ${entry.reportPrice.toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", color: "var(--muted)" }}>
                      {entry.score ?? "—"}
                    </td>
                    {entry.checkpoints.map((cp) => <CheckpointCell key={cp.days} cp={cp} />)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 11, color: "#475569", marginTop: 16, fontFamily: "var(--font-mono, monospace)" }}>
        Prices fetched from Yahoo Finance · Cached in web/data/backtest-cache.json · Not financial advice
      </p>
    </div>
  );
}
