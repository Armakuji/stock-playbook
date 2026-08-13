"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/lib/LanguageContext";
import { BacktestEntry, BacktestStats, Checkpoint } from "@/lib/backtest";
import { NearMissOutcome } from "@/lib/near-miss";
import { NorthStar } from "@/lib/north-star";
import { TurboNorthStar } from "@/lib/turbo-north-star";

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
  // The /backtest/api price fetcher is a Next.js API route that only exists in
  // local dev — the site ships to Vercel as a static export with no API routes.
  // Detect after mount (avoids SSR/hydration mismatch) so PROD never shows a
  // button that would just fail with "only works locally".
  const [isLocal, setIsLocal] = useState(false);
  useEffect(() => {
    setIsLocal(/^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(window.location.hostname));
  }, []);

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

  // PROD (static export): no API route to hit — show the count as a read-only
  // note so the queue is still visible, but don't render a button that fails.
  if (!isLocal) {
    return (
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "12px 16px", borderRadius: 10, background: "#64748b14", border: "1px solid #64748b30" }}>
        <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
          {pendingItems.length} past checkpoint{pendingItems.length !== 1 ? "s" : ""} pending price lookup
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", opacity: 0.8 }}>
          — run <code>npm run backtest:fetch</code> locally to fill
        </div>
      </div>
    );
  }

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

// ── North Star ──────────────────────────────────────────────────────────────

function NorthStarSection({ ns }: { ns: NorthStar }) {
  const rate = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
  const rateColor = (v: number | null) => (v == null ? "#64748b" : v >= 0.5 ? "#10b981" : v >= 0.3 ? "#f59e0b" : "#ef4444");

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px", marginBottom: 24 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: "var(--font-mono, monospace)", marginBottom: 6 }}>
        ⭐ North Star — +{ns.targetPct}% within {ns.windowDays} days
      </div>
      <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 16px", lineHeight: 1.6 }}>
        The actual job of a 30% hunter, measured. MAE = max drawdown endured before the target hit.
      </p>

      {ns.totalComplete === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>⏳</div>
          {ns.totalAccumulating} window{ns.totalAccumulating === 1 ? "" : "s"} still filling — run <code>npm run backtest:fetch</code> as the 14-day windows complete.
        </div>
      ) : (
        <>
          {/* Hero stats */}
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 34, fontWeight: 900, color: rateColor(ns.hitRate), fontFamily: "var(--font-mono, monospace)", lineHeight: 1 }}>{rate(ns.hitRate)}</div>
              <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)", marginTop: 3 }}>hit rate · n={ns.totalComplete}</div>
            </div>
            <div>
              <div style={{ fontSize: 34, fontWeight: 900, color: ns.medianMAE != null && ns.medianMAE > -15 ? "#10b981" : "#f59e0b", fontFamily: "var(--font-mono, monospace)", lineHeight: 1 }}>{fmtPct(ns.medianMAE)}</div>
              <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)", marginTop: 3 }}>median MAE</div>
            </div>
          </div>

          {/* By catalyst type */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Catalyst type", "n", "Hit +30%", "Median MAE", "Avg max gain"].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: h === "Catalyst type" ? "left" : "center", fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ns.byType.map((t, i) => (
                  <tr key={t.type} style={{ borderBottom: i < ns.byType.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 700 }}>{t.icon} {t.label}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", color: "var(--muted)" }}>{t.n}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800, color: rateColor(t.hitRate) }}>{rate(t.hitRate)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: t.medianMAE != null && t.medianMAE > -15 ? "#10b981" : "#f59e0b" }}>{fmtPct(t.medianMAE)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: t.avgMaxGain != null && t.avgMaxGain >= 0 ? "#10b981" : "#ef4444" }}>{fmtPct(t.avgMaxGain)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Turbo North Star ──────────────────────────────────────────────────────

function TurboNorthStarSection({ ns }: { ns: TurboNorthStar }) {
  const rate = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
  const rateColor = (v: number | null) => (v == null ? "#64748b" : v >= 0.5 ? "#10b981" : v >= 0.3 ? "#f59e0b" : "#ef4444");
  const small = ns.totalComplete > 0 && ns.totalComplete < 5;

  // Paginated entries table — this list grows one row per turbo snapshot and
  // was rendering all of them (84 as of 2026-08-13), which made the /backtest
  // page unusably long. Same page size and control pattern as the near-miss
  // and checkpoints tables below.
  const TURBO_PAGE_SIZE = 10;
  const [turboPage, setTurboPage] = useState(1);
  const turboTotalPages = Math.max(1, Math.ceil(ns.entries.length / TURBO_PAGE_SIZE));
  const pagedTurboEntries = ns.entries.slice(
    (turboPage - 1) * TURBO_PAGE_SIZE,
    turboPage * TURBO_PAGE_SIZE
  );

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px", marginBottom: 24 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#ff6d00", textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: "var(--font-mono, monospace)", marginBottom: 6 }}>
        🎰 Turbo — +{ns.targetPct}% within {ns.windowDays} days
      </div>
      <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
        Moonshot picks (web/data/speculative/) are lottery tickets, not 2-week catalyst events — measured on their own thesis, kept out of the core stats/table above.
      </p>

      <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginBottom: 16 }}>
        n = {ns.n} turbo snapshot{ns.n !== 1 ? "s" : ""} total · {ns.totalComplete} complete · {ns.totalAccumulating} accumulating{ns.totalNoData > 0 ? ` · ${ns.totalNoData} no-data` : ""}
      </div>

      {small && (
        <div style={{
          padding: "8px 12px", borderRadius: 8, marginBottom: 16,
          background: "#f59e0b18", border: "1px solid #f59e0b30",
          fontSize: 11.5, color: "#f59e0b", fontFamily: "var(--font-mono, monospace)",
        }}>
          ⚠️ Sample too small (n={ns.totalComplete}) — directional only, not a real hit rate yet.
        </div>
      )}

      {ns.totalComplete === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>⏳</div>
          {ns.totalAccumulating} window{ns.totalAccumulating === 1 ? "" : "s"} still filling — run <code>npm run backtest:fetch</code> as the 30-day windows complete.
        </div>
      ) : (
        <>
          {/* Hero stats */}
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 34, fontWeight: 900, color: rateColor(ns.hitRate), fontFamily: "var(--font-mono, monospace)", lineHeight: 1 }}>{rate(ns.hitRate)}</div>
              <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)", marginTop: 3 }}>hit rate · n={ns.totalComplete}</div>
            </div>
            <div>
              <div style={{ fontSize: 34, fontWeight: 900, color: ns.medianMAE != null && ns.medianMAE > -30 ? "#10b981" : "#f59e0b", fontFamily: "var(--font-mono, monospace)", lineHeight: 1 }}>{fmtPct(ns.medianMAE)}</div>
              <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)", marginTop: 3 }}>median MAE</div>
            </div>
            <div>
              <div style={{ fontSize: 34, fontWeight: 900, color: "#d500f9", fontFamily: "var(--font-mono, monospace)", lineHeight: 1 }}>{ns.medianTimeToHit != null ? `${ns.medianTimeToHit}d` : "—"}</div>
              <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)", marginTop: 3 }}>median time-to-hit</div>
            </div>
          </div>

          {/* Time-to-hit distribution */}
          {ns.timeToHitDistribution.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono, monospace)", marginBottom: 6 }}>
                Time-to-hit distribution (days)
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ns.timeToHitDistribution.map((d, i) => (
                  <span key={i} style={{
                    fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 6,
                    background: "#d500f918", color: "#d500f9", border: "1px solid #d500f930",
                    fontFamily: "var(--font-mono, monospace)",
                  }}>
                    Day {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Entries table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Ticker", "Report Date", "Status", "Max Gain", "MAE", "Hit +50%", "Time-to-hit"].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: h === "Ticker" ? "left" : "center", fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedTurboEntries.map((e, i) => (
                  <tr key={`${e.ticker}-${e.reportDate}`} style={{ borderBottom: i < pagedTurboEntries.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 800 }}>{e.ticker}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", color: "var(--muted)" }}>{fmtDate(e.reportDate)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 5,
                        background: e.status === "complete" ? "#10b98118" : e.status === "accumulating" ? "#3b82f618" : "#64748b18",
                        color: e.status === "complete" ? "#10b981" : e.status === "accumulating" ? "#3b82f6" : "#64748b",
                        border: `1px solid ${e.status === "complete" ? "#10b98130" : e.status === "accumulating" ? "#3b82f630" : "#64748b30"}`,
                      }}>
                        {e.status}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: e.maxGainPct != null && e.maxGainPct >= 0 ? "#10b981" : "#64748b" }}>{fmtPct(e.maxGainPct)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#f59e0b" }}>{fmtPct(e.maePct)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800, color: e.hit ? "#10b981" : e.hit === false ? "#ef4444" : "#64748b" }}>{e.hit == null ? "—" : e.hit ? "✓" : "✗"}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", color: "var(--muted)" }}>{e.timeToHitDays != null ? `${e.timeToHitDays}d` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ns.entries.length > TURBO_PAGE_SIZE && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              paddingTop: 12, marginTop: 4,
              fontFamily: "var(--font-mono, monospace)", fontSize: 11,
            }}>
              <button
                onClick={() => setTurboPage((p) => Math.max(1, p - 1))}
                disabled={turboPage === 1}
                style={{
                  padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)",
                  background: "transparent", color: turboPage === 1 ? "var(--muted)" : "var(--text)",
                  fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                  cursor: turboPage === 1 ? "default" : "pointer",
                  opacity: turboPage === 1 ? 0.4 : 1,
                }}
              >
                ← Prev
              </button>
              <span style={{ color: "var(--muted)" }}>
                Page {turboPage} of {turboTotalPages} · {ns.entries.length} total
              </span>
              <button
                onClick={() => setTurboPage((p) => Math.min(turboTotalPages, p + 1))}
                disabled={turboPage === turboTotalPages}
                style={{
                  padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)",
                  background: "transparent", color: turboPage === turboTotalPages ? "var(--muted)" : "var(--text)",
                  fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                  cursor: turboPage === turboTotalPages ? "default" : "pointer",
                  opacity: turboPage === turboTotalPages ? 0.4 : 1,
                }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Near-miss log ───────────────────────────────────────────────────────────

function NearMissSection({ nearMisses, pickAvg30 }: { nearMisses: NearMissOutcome[]; pickAvg30: number | null }) {
  const completed = nearMisses.filter((n) => n.pct30 !== null);
  const nmAvg30 = completed.length
    ? completed.reduce((s, n) => s + (n.pct30 as number), 0) / completed.length
    : null;
  const edge = pickAvg30 !== null && nmAvg30 !== null ? pickAvg30 - nmAvg30 : null;

  const NEAR_MISS_PAGE_SIZE = 5;
  const [nearMissPage, setNearMissPage] = useState(1);
  const nearMissTotalPages = Math.max(1, Math.ceil(nearMisses.length / NEAR_MISS_PAGE_SIZE));
  const pagedNearMisses = nearMisses.slice(
    (nearMissPage - 1) * NEAR_MISS_PAGE_SIZE,
    nearMissPage * NEAR_MISS_PAGE_SIZE
  );

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px", marginTop: 24 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: "var(--font-mono, monospace)", marginBottom: 6 }}>
        🕵️ Near-Miss Log — Selection Counterfactual
      </div>
      <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 16px", lineHeight: 1.6 }}>
        Candidates that passed the screen but missed the top 5. If picks don&apos;t beat near-misses, the ranking isn&apos;t adding alpha.
      </p>

      {nearMisses.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
          No near-misses logged yet — <code>/dashboard</code> will record qualified-but-not-picked candidates here.
        </div>
      ) : (
        <>
          {edge !== null && (
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 16, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
              <span>Picks avg 30d: <strong style={{ color: pickAvg30! >= 0 ? "#10b981" : "#ef4444" }}>{fmtPct(pickAvg30)}</strong></span>
              <span>Near-miss avg 30d: <strong style={{ color: nmAvg30! >= 0 ? "#10b981" : "#ef4444" }}>{fmtPct(nmAvg30)}</strong></span>
              <span>Selection edge: <strong style={{ color: edge >= 0 ? "#10b981" : "#ef4444" }}>{fmtPct(edge)}</strong></span>
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Screen", "Stock", "Why missed", "+14d", "+30d"].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: h === "Why missed" || h === "Stock" ? "left" : "center", fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedNearMisses.map((n, i) => (
                  <tr key={`${n.ticker}-${n.screenDate}-${i}`} style={{ borderBottom: i < pagedNearMisses.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "8px 12px", textAlign: "center", color: "var(--muted)", fontSize: 11, whiteSpace: "nowrap" }}>{fmtDate(n.screenDate)}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 800 }}>{n.ticker}</td>
                    <td style={{ padding: "8px 12px", color: "var(--muted)", fontSize: 11 }}>{n.reason}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: n.pct14 == null ? "#64748b" : n.pct14 >= 0 ? "#10b981" : "#ef4444" }}>{fmtPct(n.pct14)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: n.pct30 == null ? "#64748b" : n.pct30 >= 0 ? "#10b981" : "#ef4444" }}>{fmtPct(n.pct30)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nearMisses.length > NEAR_MISS_PAGE_SIZE && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              paddingTop: 12, marginTop: 4,
              fontFamily: "var(--font-mono, monospace)", fontSize: 11,
            }}>
              <button
                onClick={() => setNearMissPage((p) => Math.max(1, p - 1))}
                disabled={nearMissPage === 1}
                style={{
                  padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)",
                  background: "transparent", color: nearMissPage === 1 ? "var(--muted)" : "var(--text)",
                  fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                  cursor: nearMissPage === 1 ? "default" : "pointer",
                  opacity: nearMissPage === 1 ? 0.4 : 1,
                }}
              >
                ← Prev
              </button>
              <span style={{ color: "var(--muted)" }}>
                Page {nearMissPage} of {nearMissTotalPages} · {nearMisses.length} total
              </span>
              <button
                onClick={() => setNearMissPage((p) => Math.min(nearMissTotalPages, p + 1))}
                disabled={nearMissPage === nearMissTotalPages}
                style={{
                  padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)",
                  background: "transparent", color: nearMissPage === nearMissTotalPages ? "var(--muted)" : "var(--text)",
                  fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                  cursor: nearMissPage === nearMissTotalPages ? "default" : "pointer",
                  opacity: nearMissPage === nearMissTotalPages ? 0.4 : 1,
                }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function BacktestContent({ entries, stats, nearMisses, northStar, turboNorthStar }: { entries: BacktestEntry[]; stats: BacktestStats; nearMisses: NearMissOutcome[]; northStar: NorthStar; turboNorthStar: TurboNorthStar }) {
  const { lang } = useLang();
  const th = lang === "th";
  const pick30 = entries.flatMap((e) => e.checkpoints.filter((c) => c.days === 30 && c.actualPct !== null).map((c) => c.actualPct as number));
  const pickAvg30 = pick30.length ? pick30.reduce((s, v) => s + v, 0) / pick30.length : null;
  // Items that are past due but have no cached price yet
  const today = new Date().toISOString().slice(0, 10);
  const pendingFetches = entries.flatMap((e) =>
    e.checkpoints
      .filter((c) => c.status === "pending" && c.targetDate <= today)
      .map((c) => ({ ticker: e.ticker, date: c.targetDate }))
  );

  const verdictOrder = ["BUY", "SPECULATIVE", "HOLD", "SELL"] as const;
  const allPending = stats.completedCheckpoints === 0;

  const CHECKPOINTS_PAGE_SIZE = 5;
  const [checkpointsPage, setCheckpointsPage] = useState(1);
  const checkpointsTotalPages = Math.max(1, Math.ceil(entries.length / CHECKPOINTS_PAGE_SIZE));
  const pagedEntries = entries.slice(
    (checkpointsPage - 1) * CHECKPOINTS_PAGE_SIZE,
    checkpointsPage * CHECKPOINTS_PAGE_SIZE
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>{th ? "← หน้าหลัก" : "← Home"}</Link>
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

      {/* North Star — the headline metric */}
      <NorthStarSection ns={northStar} />

      {/* Turbo North Star — separate thesis, separate section (never mixed into core stats/table) */}
      <TurboNorthStarSection ns={turboNorthStar} />

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
              {pagedEntries.map((entry, idx) => {
                const vc = VERDICT_COLORS[entry.verdict] ?? "#64748b";
                const baseBg = idx % 2 === 0 ? "transparent" : "#ffffff04";
                return (
                  <tr key={`${entry.ticker}-${entry.reportDate}`} style={{ background: baseBg, borderBottom: idx < pagedEntries.length - 1 ? "1px solid var(--border)" : "none" }}>
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
        {entries.length > CHECKPOINTS_PAGE_SIZE && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 20px", borderTop: "1px solid var(--border)",
            fontFamily: "var(--font-mono, monospace)", fontSize: 11,
          }}>
            <button
              onClick={() => setCheckpointsPage((p) => Math.max(1, p - 1))}
              disabled={checkpointsPage === 1}
              style={{
                padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)",
                background: "transparent", color: checkpointsPage === 1 ? "var(--muted)" : "var(--text)",
                fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                cursor: checkpointsPage === 1 ? "default" : "pointer",
                opacity: checkpointsPage === 1 ? 0.4 : 1,
              }}
            >
              ← Prev
            </button>
            <span style={{ color: "var(--muted)" }}>
              Page {checkpointsPage} of {checkpointsTotalPages} · {entries.length} total
            </span>
            <button
              onClick={() => setCheckpointsPage((p) => Math.min(checkpointsTotalPages, p + 1))}
              disabled={checkpointsPage === checkpointsTotalPages}
              style={{
                padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)",
                background: "transparent", color: checkpointsPage === checkpointsTotalPages ? "var(--muted)" : "var(--text)",
                fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                cursor: checkpointsPage === checkpointsTotalPages ? "default" : "pointer",
                opacity: checkpointsPage === checkpointsTotalPages ? 0.4 : 1,
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Near-miss counterfactual */}
      <NearMissSection nearMisses={nearMisses} pickAvg30={pickAvg30} />

      <p style={{ fontSize: 11, color: "#475569", marginTop: 16, fontFamily: "var(--font-mono, monospace)" }}>
        Prices fetched from Yahoo Finance · Cached in web/data/backtest-cache.json · Not financial advice
      </p>
    </div>
  );
}
