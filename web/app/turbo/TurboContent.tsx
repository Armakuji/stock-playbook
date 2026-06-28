"use client";

import { TurboCard } from "./TurboCard";
import { RankingChangeTable } from "../RankingChangeTable";
import { useLang } from "@/lib/LanguageContext";
import type { rankTurboReports } from "@/lib/speculative";
import type { RankChange } from "@/lib/ranking-history";

type Ranked = ReturnType<typeof rankTurboReports>;

export function TurboContent({ ranked, rankChanges = [] }: { ranked: Ranked; rankChanges?: RankChange[] }) {
  const { lang } = useLang();
  const th = lang === "th";

  const avgMoon =
    ranked.length > 0
      ? Math.round(ranked.reduce((s, r) => s + r.moonPct, 0) / ranked.length)
      : 0;
  const topPick = ranked[0];
  const over300 = ranked.filter((r) => r.moonPct >= 300).length;
  const over500 = ranked.filter((r) => r.moonPct >= 500).length;

  const statsItems = [
    { label: th ? "ตัวเด่น" : "Top Pick",       value: topPick?.ticker ?? "—", color: "#ff6d00" },
    { label: th ? "Moon % เฉลี่ย" : "Avg Moon %", value: `+${avgMoon}%`,        color: "#ff6d00" },
    { label: th ? "300%+ ตัว" : "300%+ Picks",   value: `${over300}`,           color: "#d500f9" },
    { label: th ? "500%+ ตัว" : "500%+ Picks",   value: `${over500}`,           color: "#d500f9" },
    { label: th ? "ทั้งหมด" : "Total Turbo",     value: `${ranked.length}`,     color: "#7f4040" },
  ];

  return (
    <div style={{ position: "relative" }}>

      {/* ── Ambient heat layer ────────────────────────────────────────── */}
      <div aria-hidden="true" style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)",
          width: "min(900px, 120vw)", height: 600,
          background: "radial-gradient(ellipse at center, rgba(255,61,0,0.07) 0%, transparent 65%)",
        }} />
        <div style={{
          position: "absolute", bottom: "-10%", right: "-5%",
          width: 600, height: 500,
          background: "radial-gradient(ellipse at center, rgba(213,0,249,0.05) 0%, transparent 65%)",
        }} />
        <div style={{
          position: "absolute", top: "40%", left: "-10%",
          width: 400, height: 400,
          background: "radial-gradient(ellipse at center, rgba(255,109,0,0.04) 0%, transparent 65%)",
        }} />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ── Hero header ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ position: "relative", width: 18, height: 18, flexShrink: 0 }}>
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: "2px solid #ff3d00",
                animation: "turboPulse 1.5s ease-in-out infinite",
              }} />
              <div style={{
                position: "absolute", inset: 4, borderRadius: "50%",
                background: "linear-gradient(135deg, #ff6d00, #d500f9)",
              }} />
            </div>
            <h1 style={{
              fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 900, margin: 0,
              letterSpacing: "-0.5px", fontFamily: "var(--font-display, sans-serif)",
              background: "linear-gradient(90deg, #ff6d00, #ff3d00, #d500f9)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              🔥 Turbo-Stock
            </h1>
          </div>

          <p style={{
            fontSize: 12, color: "#7f3030", margin: "0 0 20px",
            fontFamily: "var(--font-mono, monospace)",
          }}>
            {ranked.length > 0
              ? th
                ? `${ranked.length} ตัว · เรียงตาม 🔥 upside มากสุด (bull case) · small/mid cap เด้ง 300%++`
                : `${ranked.length} picks · ranked by 🔥 most potential upside (bull case) · small/mid cap 300%++ plays`
              : th
                ? "ยังไม่มี turbo picks — รัน /analyze-turbo TICKER เพื่อสร้าง"
                : "No turbo picks yet — run /analyze-turbo TICKER to generate one"}
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
                  background: "#0e0508",
                  border: "1px solid #2d1010",
                  borderRadius: 10, padding: "10px 12px",
                }}>
                  <div style={{
                    fontSize: 9, color: "#4d2020", textTransform: "uppercase",
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

          {/* ── Moon tier badges ──────────────────────────────────────── */}
          {ranked.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {over500 > 0 && (
                <span style={{
                  fontSize: 11, padding: "4px 12px", borderRadius: 8,
                  background: "#d500f918", color: "#d500f9",
                  border: "1px solid #d500f930", fontWeight: 800,
                  fontFamily: "var(--font-mono, monospace)",
                }}>
                  🌙 500%+ ×{over500}
                </span>
              )}
              {over300 > 0 && (
                <span style={{
                  fontSize: 11, padding: "4px 12px", borderRadius: 8,
                  background: "#ff3d0018", color: "#ff6d00",
                  border: "1px solid #ff3d0030", fontWeight: 800,
                  fontFamily: "var(--font-mono, monospace)",
                }}>
                  🔥 300%+ ×{over300}
                </span>
              )}
              <span style={{
                fontSize: 11, padding: "4px 12px", borderRadius: 8,
                background: "#13050a", color: "#4d2020",
                border: "1px solid #2d1010", fontWeight: 800,
                fontFamily: "var(--font-mono, monospace)",
              }}>
                {th ? "เรียงตาม: 🔥 upside มากสุด (bull %)" : "sorted: 🔥 most potential up (bull %)"}
              </span>
            </div>
          )}
        </div>

        {/* ── Divider with flame accent ─────────────────────────────────── */}
        <div style={{
          height: 1, marginBottom: 20,
          background: "linear-gradient(90deg, transparent, #ff3d00, #d500f9, transparent)",
        }} />

        {/* ── Card grid ─────────────────────────────────────────────────── */}
        {ranked.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "80px 0", color: "#4d2020",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔥</div>
            <p style={{ fontSize: 15, margin: 0, color: "#7f3030" }}>
              {th ? "ยังไม่มี turbo picks" : "No turbo picks yet."}
            </p>
            <p style={{ fontSize: 13, margin: "8px 0 0", color: "#4d2020", fontFamily: "var(--font-mono, monospace)" }}>
              {th ? "รัน " : "Run "}<code style={{ color: "#ff6d00" }}>/analyze-turbo TICKER</code>{th ? " เพื่อเพิ่ม moonshot" : " to add a moonshot pick."}
            </p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {ranked.map((r) => (
              <TurboCard
                key={r.ticker}
                report={r}
                rank={r.rank}
                moonPct={r.moonPct}
                bullPct={r.bullPct}
              />
            ))}
          </div>
        )}

        {/* ── Ranking Change ────────────────────────────────────────────── */}
        <RankingChangeTable rows={rankChanges} />

        {/* ── Risk reminder ─────────────────────────────────────────────── */}
        {ranked.length > 0 && (
          <div style={{
            marginTop: 32,
            padding: "12px 16px",
            background: "#0e0508",
            border: "1px solid #2d1010",
            borderLeft: "3px solid #ff3d00",
            borderRadius: 8,
            fontSize: 12, color: "#7f3030",
          }}>
            {th ? (
              <>⚠️ <strong style={{ color: "#ff6d00" }}>Turbo-Stock คือ high-risk zone</strong> — size 2–5% ต่อตัวเท่านั้น
              · มี stop loss ทุกตัวก่อนเข้า · moon case เป็น speculative bull scenario ไม่ใช่ guarantee
              · Not financial advice</>
            ) : (
              <>⚠️ <strong style={{ color: "#ff6d00" }}>Turbo-Stock is a high-risk zone</strong> — size 2–5% per name only
              · always set a stop before entry · the moon case is a speculative bull scenario, not a guarantee
              · Not financial advice</>
            )}
          </div>
        )}

      </div>

      <style>{`
        @keyframes turboPulse {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(255,61,0,0.5); }
          50% { opacity: 0.7; transform: scale(1.3); box-shadow: 0 0 0 5px rgba(255,61,0,0); }
        }
      `}</style>
    </div>
  );
}
