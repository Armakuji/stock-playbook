import { getAllDcaReports, rankDcaReports } from "@/lib/dca";
import { DcaCard } from "./DcaCard";

export default function DcaPage() {
  const reports = getAllDcaReports();
  const ranked = rankDcaReports(reports);

  const topPick = ranked[0];
  const cheap = ranked.filter((r) => r.valuationBand?.zone === "cheap").length;
  const avgScore =
    ranked.length > 0
      ? Math.round(ranked.reduce((s, r) => s + (r.dcaScore ?? 0), 0) / ranked.length)
      : 0;
  const buyNow = ranked.filter(
    (r) => r.valuationBand?.zone === "cheap" || r.valuationBand?.zone === "fair"
  ).length;

  const statsItems = [
    { label: "Top Pick",    value: topPick?.ticker ?? "—", color: "#7dd3fc" },
    { label: "Avg Score",   value: `${avgScore}`,          color: "#38bdf8" },
    { label: "Accumulate",  value: `${buyNow}`,            color: "#2dd4bf" },
    { label: "Below Fair",  value: `${cheap}`,             color: "#10b981" },
    { label: "Total Core",  value: `${ranked.length}`,     color: "#4a6b78" },
  ];

  return (
    <div style={{ position: "relative" }}>

      {/* ── Ambient cool layer ────────────────────────────────────────── */}
      <div aria-hidden="true" style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)",
          width: "min(900px, 120vw)", height: 600,
          background: "radial-gradient(ellipse at center, rgba(56,189,248,0.06) 0%, transparent 65%)",
        }} />
        <div style={{
          position: "absolute", bottom: "-10%", right: "-5%",
          width: 600, height: 500,
          background: "radial-gradient(ellipse at center, rgba(45,212,191,0.045) 0%, transparent 65%)",
        }} />
        <div style={{
          position: "absolute", top: "40%", left: "-10%",
          width: 400, height: 400,
          background: "radial-gradient(ellipse at center, rgba(16,185,129,0.035) 0%, transparent 65%)",
        }} />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ── Hero header ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ position: "relative", width: 18, height: 18, flexShrink: 0 }}>
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: "2px solid #38bdf8",
                animation: "dcaPulse 2.4s ease-in-out infinite",
              }} />
              <div style={{
                position: "absolute", inset: 4, borderRadius: "50%",
                background: "linear-gradient(135deg, #2dd4bf, #38bdf8)",
              }} />
            </div>
            <h1 style={{
              fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 900, margin: 0,
              letterSpacing: "-0.5px", fontFamily: "var(--font-display, sans-serif)",
              background: "linear-gradient(90deg, #2dd4bf, #38bdf8, #7dd3fc)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              💧 DCA List
            </h1>
          </div>

          <p style={{
            fontSize: 12, color: "#4a6b78", margin: "0 0 20px",
            fontFamily: "var(--font-mono, monospace)",
          }}>
            {ranked.length > 0
              ? `${ranked.length} core holdings · ranked by quality + valuation · ถือยาว 3–5 ปี ทยอยสะสม`
              : "No DCA picks yet — run /dca-list to build the quality-core list"}
          </p>

          {/* ── Stats strip ───────────────────────────────────────────── */}
          {ranked.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
              gap: 8, marginBottom: 20,
            }}>
              {statsItems.map(({ label, value, color }) => (
                <div key={label} style={{
                  background: "#07111a",
                  border: "1px solid #102530",
                  borderRadius: 10, padding: "10px 12px",
                }}>
                  <div style={{
                    fontSize: 9, color: "#3a5560", textTransform: "uppercase",
                    letterSpacing: "1px", marginBottom: 4,
                    fontFamily: "var(--font-mono, monospace)",
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontSize: 17, fontWeight: 800, color,
                    fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.5px",
                  }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Zone legend ───────────────────────────────────────────── */}
          {ranked.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{
                fontSize: 11, padding: "4px 12px", borderRadius: 8,
                background: "#10b98118", color: "#10b981",
                border: "1px solid #10b98130", fontWeight: 800,
                fontFamily: "var(--font-mono, monospace)",
              }}>
                🟢 cheap · สะสมได้
              </span>
              <span style={{
                fontSize: 11, padding: "4px 12px", borderRadius: 8,
                background: "#38bdf818", color: "#38bdf8",
                border: "1px solid #38bdf830", fontWeight: 800,
                fontFamily: "var(--font-mono, monospace)",
              }}>
                🔵 fair · ทยอยเข้า
              </span>
              <span style={{
                fontSize: 11, padding: "4px 12px", borderRadius: 8,
                background: "#0d1f29", color: "#4a6b78",
                border: "1px solid #102530", fontWeight: 800,
                fontFamily: "var(--font-mono, monospace)",
              }}>
                sorted: quality + valuation
              </span>
            </div>
          )}
        </div>

        {/* ── Divider with cool accent ──────────────────────────────────── */}
        <div style={{
          height: 1, marginBottom: 20,
          background: "linear-gradient(90deg, transparent, #2dd4bf, #38bdf8, transparent)",
        }} />

        {/* ── Card grid ─────────────────────────────────────────────────── */}
        {ranked.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#3a5560" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💧</div>
            <p style={{ fontSize: 15, margin: 0, color: "#4a6b78" }}>
              No DCA picks yet.
            </p>
            <p style={{ fontSize: 13, margin: "8px 0 0", color: "#3a5560", fontFamily: "var(--font-mono, monospace)" }}>
              Run <code style={{ color: "#7dd3fc" }}>/dca-list</code> to build the quality-core list.
            </p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {ranked.map((r) => (
              <DcaCard key={r.ticker} report={r} rank={r.rank} />
            ))}
          </div>
        )}

        {/* ── Strategy reminder ─────────────────────────────────────────── */}
        {ranked.length > 0 && (
          <div style={{
            marginTop: 32,
            padding: "12px 16px",
            background: "#07111a",
            border: "1px solid #102530",
            borderLeft: "3px solid #38bdf8",
            borderRadius: 8,
            fontSize: 12, color: "#5a7a86",
          }}>
            💧 <strong style={{ color: "#7dd3fc" }}>DCA = core ถือยาว คุณภาพสูง</strong> — ทยอยสะสมตาม cadence ไม่ต้องรอ catalyst
            · ออกเมื่อ thesis พัง (ไม่ใช่ stop loss รายวัน) · valuation gauge บอกว่าตอนนี้เข้าคุ้มไหม
            · Not financial advice
          </div>
        )}

      </div>

      <style>{`
        @keyframes dcaPulse {
          0%, 100% { transform: scale(1);   opacity: 1; }
          50%      { transform: scale(1.25); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
