"use client";

// ─── StalenessBanner ─────────────────────────────────────────────────────────
// Reports are dated snapshots. When you generate often, old reports linger and
// readers can act on stale entry levels. This banner always shows how old the
// report is, and — when a live quote is reachable — how far price has drifted
// since it was written. Degrades gracefully if /api/prices is unavailable.

import { useEffect, useState } from "react";

const SEV = {
  high: { color: "#ef4444", bg: "#ef444416", border: "#ef444440" },
  med:  { color: "#f59e0b", bg: "#f59e0b16", border: "#f59e0b40" },
  low:  { color: "#10b981", bg: "#10b98114", border: "#10b98138" },
} as const;

export function StalenessBanner({
  ticker, reportPrice, generatedAt,
}: { ticker: string; reportPrice: number; generatedAt: string }) {
  const [live, setLive] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/prices?tickers=${encodeURIComponent(ticker)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!alive) return;
        const p = d?.[ticker]?.price;
        if (typeof p === "number") setLive(p);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [ticker]);

  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(generatedAt).getTime()) / 86_400_000));
  const drift = live != null && reportPrice > 0 ? ((live - reportPrice) / reportPrice) * 100 : null;

  const sev: keyof typeof SEV =
    ageDays >= 7 || (drift != null && Math.abs(drift) >= 8) ? "high" :
    ageDays >= 3 || (drift != null && Math.abs(drift) >= 4) ? "med" : "low";
  const c = SEV[sev];

  const ageText = ageDays === 0 ? "written today" : `written ${ageDays} day${ageDays === 1 ? "" : "s"} ago`;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "8px 14px", marginBottom: 14, borderRadius: 10,
      background: c.bg, border: `1px solid ${c.border}`,
      fontFamily: "var(--font-mono, monospace)", fontSize: 11.5,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
      <span style={{ color: c.color, fontWeight: 800, letterSpacing: "0.3px" }}>
        {sev === "low" ? "FRESH" : "STALE?"}
      </span>
      <span style={{ color: "var(--muted)" }}>
        Report {ageText} · at ${reportPrice.toFixed(2)}
      </span>
      {drift != null && (
        <span style={{ color: c.color, fontWeight: 700 }}>
          {drift >= 0 ? "▲" : "▼"} {Math.abs(drift).toFixed(1)}% since · live ${live!.toFixed(2)}
        </span>
      )}
      {failed && <span style={{ color: "var(--muted)" }}>· live price unavailable</span>}
      {sev !== "low" && (
        <span style={{ color: "var(--muted)", fontStyle: "italic" }}>
          entry levels may be stale — re-check before acting
        </span>
      )}
    </div>
  );
}
