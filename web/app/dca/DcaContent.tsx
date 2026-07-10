"use client";

import { useState } from "react";
import { DcaCard } from "./DcaCard";
import { RankingChangeTable } from "../RankingChangeTable";
import { useLang } from "@/lib/LanguageContext";
import type { RankedDca } from "@/lib/dca";
import type { RankChange } from "@/lib/ranking-history";

type Tab = "funds" | "stocks";

// ── Ranking Change with its own Funds/Stocks toggle (independent of main tab) ──
function RankingChangeSection({
  fundChanges, stockChanges, initial, th,
}: { fundChanges: RankChange[]; stockChanges: RankChange[]; initial: Tab; th: boolean }) {
  const [t, setT] = useState<Tab>(initial);
  const rows = t === "funds" ? fundChanges : stockChanges;
  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: "funds", icon: "🏦", label: th ? "กองทุน" : "Funds" },
    { key: "stocks", icon: "📈", label: th ? "หุ้น" : "Stocks" },
  ];
  if (fundChanges.length === 0 && stockChanges.length === 0) return null;

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 10 }}>
        <div style={{ display: "inline-flex", gap: 2, background: "#07111a", border: "1px solid #102530", borderRadius: 9, padding: 3 }}>
          {tabs.map((x) => {
            const active = t === x.key;
            return (
              <button key={x.key} onClick={() => setT(x.key)} style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, fontWeight: 800, padding: "5px 12px", borderRadius: 6,
                border: "none", cursor: "pointer", fontFamily: "var(--font-mono, monospace)",
                background: active ? "linear-gradient(90deg, #2dd4bf, #38bdf8)" : "transparent",
                color: active ? "#04080a" : "#4a6b78", transition: "background .15s, color .15s",
              }}>
                <span>{x.icon}</span>{x.label}
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4,
                  background: active ? "rgba(4,8,10,0.18)" : "#102530", color: active ? "#04080a" : "#4a6b78",
                }}>
                  {(x.key === "funds" ? fundChanges : stockChanges).length}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {rows.length > 0 ? (
        <RankingChangeTable rows={rows} />
      ) : (
        <div style={{ textAlign: "center", padding: "24px 0", color: "#3a5560", fontSize: 12, fontFamily: "var(--font-mono, monospace)" }}>
          {th ? "ยังไม่มีการเปลี่ยนอันดับสำหรับกลุ่มนี้" : "No ranking changes yet for this group"}
        </div>
      )}
    </div>
  );
}

export function DcaContent({
  funds,
  stocks,
  fundChanges = [],
  stockChanges = [],
}: {
  funds: RankedDca[];
  stocks: RankedDca[];
  fundChanges?: RankChange[];
  stockChanges?: RankChange[];
}) {
  const { lang } = useLang();
  const th = lang === "th";
  const [tab, setTab] = useState<Tab>("funds");

  const isFund = tab === "funds";
  const ranked = isFund ? funds : stocks;

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
    { label: th ? "ตัวเด่น" : "Top Pick",      value: topPick?.ticker ?? "—", color: "#7dd3fc" },
    { label: th ? "คะแนนเฉลี่ย" : "Avg Score", value: `${avgScore}`,          color: "#38bdf8" },
    { label: th ? "สะสมได้" : "Accumulate",     value: `${buyNow}`,            color: "#2dd4bf" },
    { label: th ? "ต่ำกว่า fair" : "Below Fair", value: `${cheap}`,            color: "#10b981" },
    {
      label: isFund ? (th ? "ทั้งหมด" : "Total ETF") : (th ? "ทั้งหมด" : "Total Core"),
      value: `${ranked.length}`, color: "#4a6b78",
    },
  ];

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "funds",  icon: "🏦", label: th ? "กองทุน" : "Funds" },
    { key: "stocks", icon: "📈", label: th ? "หุ้น" : "Stocks" },
  ];

  return (
    <div className="theme-water" style={{ position: "relative" }}>

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
        <div style={{ marginBottom: 18 }}>
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
          <p style={{ fontSize: 12, color: "#4a6b78", margin: 0, fontFamily: "var(--font-mono, monospace)" }}>
            {th ? "5 กองทุน + 5 หุ้น ที่ดีที่สุดสำหรับสะสมระยะยาว" : "The 5 best funds + 5 best stocks to accumulate for the long run"}
          </p>
        </div>

        {/* ── Tab switcher ──────────────────────────────────────────────── */}
        <div style={{
          display: "inline-flex", gap: 3, marginBottom: 20,
          background: "#07111a", border: "1px solid #102530", borderRadius: 12, padding: 4,
        }}>
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 13, fontWeight: 800, padding: "8px 18px", borderRadius: 9,
                  border: "none", cursor: "pointer",
                  fontFamily: "var(--font-mono, monospace)",
                  background: active ? "linear-gradient(90deg, #2dd4bf, #38bdf8)" : "transparent",
                  color: active ? "#04080a" : "#4a6b78",
                  transition: "background .15s, color .15s",
                }}
              >
                <span>{t.icon}</span>{t.label}
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 5,
                  background: active ? "rgba(4,8,10,0.18)" : "#102530",
                  color: active ? "#04080a" : "#4a6b78",
                }}>
                  {(t.key === "funds" ? funds : stocks).length}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Subtitle + stats for the active tab ───────────────────────── */}
        <p style={{ fontSize: 12, color: "#4a6b78", margin: "0 0 16px", fontFamily: "var(--font-mono, monospace)" }}>
          {ranked.length > 0
            ? isFund
              ? (th
                  ? `${ranked.length} ETF · เรียงตามต้นทุนต่ำ + กระจายความเสี่ยง + valuation · DCA อัตโนมัติ`
                  : `${ranked.length} ETFs · ranked by low cost + diversification + valuation · auto-DCA core`)
              : (th
                  ? `${ranked.length} หุ้น core · เรียงตาม quality + valuation · ถือยาว 3–5 ปี`
                  : `${ranked.length} core stocks · ranked by quality + valuation · hold 3–5 yrs`)
            : isFund
              ? (th ? "ยังไม่มีกองทุน — รัน /dca-list เพื่อสร้างลิสต์ ETF" : "No funds yet — run /dca-list to build the ETF list")
              : (th ? "ยังไม่มีหุ้น — รัน /dca-list เพื่อสร้างลิสต์ quality-core" : "No stocks yet — run /dca-list to build the quality-core list")}
        </p>

        {ranked.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 8, marginBottom: 20,
          }}>
            {statsItems.map(({ label, value, color }) => (
              <div key={label} style={{ background: "#07111a", border: "1px solid #102530", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, color: "#3a5560", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4, fontFamily: "var(--font-mono, monospace)" }}>
                  {label}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.5px" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div style={{ height: 1, marginBottom: 20, background: "linear-gradient(90deg, transparent, #2dd4bf, #38bdf8, transparent)" }} />

        {/* ── Card grid ─────────────────────────────────────────────────── */}
        {ranked.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#3a5560" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{isFund ? "🏦" : "📈"}</div>
            <p style={{ fontSize: 15, margin: 0, color: "#4a6b78" }}>
              {isFund ? (th ? "ยังไม่มีกองทุน" : "No funds yet.") : (th ? "ยังไม่มีหุ้น" : "No stocks yet.")}
            </p>
            <p style={{ fontSize: 13, margin: "8px 0 0", color: "#3a5560", fontFamily: "var(--font-mono, monospace)" }}>
              {th ? "รัน " : "Run "}<code style={{ color: "#7dd3fc" }}>/dca-list</code>{th ? " เพื่อสร้างลิสต์" : " to build the list."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {ranked.map((r) => (
              <DcaCard key={r.ticker} report={r} rank={r.rank} />
            ))}
          </div>
        )}

        {/* ── Ranking Change — both pools, own toggle ───────────────────── */}
        <RankingChangeSection
          fundChanges={fundChanges}
          stockChanges={stockChanges}
          initial={tab}
          th={th}
        />

        {/* ── Strategy reminder ─────────────────────────────────────────── */}
        {ranked.length > 0 && (
          <div style={{
            marginTop: 32, padding: "12px 16px",
            background: "#07111a", border: "1px solid #102530",
            borderLeft: "3px solid #38bdf8", borderRadius: 8,
            fontSize: 12, color: "#5a7a86",
          }}>
            {isFund ? (
              th ? (
                <>🏦 <strong style={{ color: "#7dd3fc" }}>กองทุน ETF = แกน DCA ที่ง่ายสุด</strong> — ต้นทุนต่ำ กระจายความเสี่ยงในตัว ทยอยสะสมรายเดือนได้เลยไม่ต้องจับจังหวะ
                · valuation gauge บอกว่าตลาดถูก/แพง · Not financial advice</>
              ) : (
                <>🏦 <strong style={{ color: "#7dd3fc" }}>ETFs = the simplest DCA core</strong> — low cost, built-in diversification, accumulate monthly without timing
                · the valuation gauge flags cheap/rich markets · Not financial advice</>
              )
            ) : (
              th ? (
                <>💧 <strong style={{ color: "#7dd3fc" }}>DCA = core ถือยาว คุณภาพสูง</strong> — ทยอยสะสมตาม cadence ไม่ต้องรอ catalyst
                · ออกเมื่อ thesis พัง (ไม่ใช่ stop loss รายวัน) · Not financial advice</>
              ) : (
                <>💧 <strong style={{ color: "#7dd3fc" }}>DCA = quality long-term core</strong> — accumulate on a cadence, no catalyst needed
                · exit on thesis-break (not a daily stop) · Not financial advice</>
              )
            )}
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
