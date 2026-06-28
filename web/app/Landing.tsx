"use client";

import Link from "next/link";
import { useLang } from "@/lib/LanguageContext";

interface ElementDef {
  href: string | null;
  element: string;       // WATER / AIR / FIRE / EARTH
  glyph: string;         // 💧 🌬️ 🔥 🌍
  feature: string;       // DCA / Catalyst / Turbo / —
  tagline: string;       // Thai one-liner
  risk: string;          // LOW / MED / HIGH / —
  horizon: string;       // 3–5y / weeks / event / —
  count: number | null;  // live pick count
  c1: string;            // gradient start
  c2: string;            // gradient end
  glow: string;          // glow rgba
  ghost?: boolean;       // coming-soon Earth tile
}

function ElementCard({ d, th }: { d: ElementDef; th: boolean }) {
  const inner = (
    <div
      style={{
        position: "relative",
        height: "100%",
        background: d.ghost ? "rgba(255,255,255,0.015)" : "var(--card)",
        border: "1px solid var(--border)",
        borderTop: `2px solid ${d.ghost ? "#3a3a2a" : d.c1}`,
        borderRadius: 16,
        padding: "22px 20px 18px",
        cursor: d.ghost ? "default" : "pointer",
        overflow: "hidden",
        transition: "transform .22s, box-shadow .22s, border-color .22s",
        opacity: d.ghost ? 0.55 : 1,
      }}
      onMouseEnter={(e) => {
        if (d.ghost) return;
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(-4px)";
        el.style.boxShadow = `0 10px 40px ${d.glow}, 0 2px 10px rgba(0,0,0,0.6)`;
        el.style.borderColor = `${d.c1}66`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
        el.style.borderColor = "var(--border)";
      }}
    >
      {/* element glow wash */}
      {!d.ghost && (
        <div style={{
          position: "absolute", top: -40, right: -40, width: 160, height: 160,
          background: `radial-gradient(circle, ${d.glow} 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
      )}

      {/* glyph + element label */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <span style={{ fontSize: 34, lineHeight: 1, filter: d.ghost ? "grayscale(1)" : "none" }}>{d.glyph}</span>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: "2px",
          fontFamily: "var(--font-mono, monospace)",
          color: d.ghost ? "var(--muted)" : "transparent",
          background: d.ghost ? "none" : `linear-gradient(90deg, ${d.c1}, ${d.c2})`,
          WebkitBackgroundClip: d.ghost ? "initial" : "text",
          WebkitTextFillColor: d.ghost ? "currentColor" : "transparent",
        }}>
          {d.element}
        </span>
      </div>

      {/* feature name */}
      <div style={{
        fontSize: 26, fontWeight: 900, letterSpacing: "-0.5px", marginBottom: 6,
        fontFamily: "var(--font-display, sans-serif)",
        color: d.ghost ? "var(--muted)" : "var(--text)",
      }}>
        {d.feature}
      </div>

      {/* tagline */}
      <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 16px", minHeight: 38 }}>
        {d.tagline}
      </p>

      {/* meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 6,
          letterSpacing: "0.5px", fontFamily: "var(--font-mono, monospace)",
          background: d.ghost ? "var(--border)" : `${d.c1}1e`,
          color: d.ghost ? "var(--muted)" : d.c1,
          border: `1px solid ${d.ghost ? "var(--border)" : `${d.c1}3a`}`,
        }}>
          {d.ghost ? "—" : th ? `เสี่ยง ${d.risk}` : `${d.risk} RISK`}
        </span>
        <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
          ⏱ {d.horizon}
        </span>
      </div>

      {/* footer: count + enter */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: 12, borderTop: "1px solid var(--border)",
      }}>
        <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
          {d.ghost
            ? (th ? "วางแผนไว้" : "planned")
            : d.count != null
              ? (th ? `${d.count} ตัว` : `${d.count} ${d.count === 1 ? "pick" : "picks"}`)
              : "—"}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 800, fontFamily: "var(--font-mono, monospace)",
          color: d.ghost ? "var(--muted)" : d.c1,
        }}>
          {d.ghost ? (th ? "เร็วๆ นี้" : "soon") : (th ? "เข้า →" : "Enter →")}
        </span>
      </div>
    </div>
  );

  if (d.ghost || !d.href) return <div style={{ height: "100%" }}>{inner}</div>;
  return <Link href={d.href} style={{ textDecoration: "none", display: "block", height: "100%" }}>{inner}</Link>;
}

export function Landing({
  waterCount,
  airCount,
  fireCount,
  lastUpdated,
  isLocal = false,
}: {
  waterCount: number;
  airCount: number;
  fireCount: number;
  lastUpdated: string;
  isLocal?: boolean;
}) {
  const { lang } = useLang();
  const th = lang === "th";

  const elements: ElementDef[] = [
    {
      href: "/dca", element: "WATER", glyph: "💧", feature: "DCA",
      tagline: th ? "Quality core · ถือยาว 3–5 ปี · ทยอยสะสมตาม valuation"
                  : "Quality core · hold 3–5 yrs · accumulate on valuation",
      risk: "LOW", horizon: th ? "3–5 ปี" : "3–5 yrs", count: waterCount,
      c1: "#38bdf8", c2: "#3b82f6", glow: "rgba(56,189,248,0.14)",
    },
    {
      href: "/catalyst", element: "AIR", glyph: "🌬️", feature: "Catalyst",
      tagline: th ? "Event-driven · ระยะสัปดาห์ · เล่นตาม catalyst ที่กำลังมา"
                  : "Event-driven · weeks · trade upcoming catalysts",
      risk: "MED", horizon: th ? "สัปดาห์" : "weeks", count: airCount,
      c1: "#10b981", c2: "#34d399", glow: "rgba(16,185,129,0.14)",
    },
    {
      href: "/turbo", element: "FIRE", glyph: "🔥", feature: "Turbo",
      tagline: th ? "Moonshot · 300%+ upside · เก็งกำไรเสี่ยงสูง 2–5% ต่อตัว"
                  : "Moonshot · 300%+ upside · high-risk, 2–5% per name",
      risk: "HIGH", horizon: "binary", count: fireCount,
      c1: "#ff6d00", c2: "#d500f9", glow: "rgba(255,109,0,0.14)",
    },
    {
      href: null, element: "EARTH", glyph: "🌍", feature: "Earth",
      tagline: th ? "รากฐาน — พอร์ต / track record · วางแผนไว้ ยังไม่เปิด"
                  : "Foundation — portfolio / track record · planned, not live",
      risk: "—", horizon: "—", count: null,
      c1: "#a16207", c2: "#84cc16", glow: "rgba(161,98,7,0.0)", ghost: true,
    },
  ];

  return (
    <div style={{ position: "relative" }}>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", padding: "36px 0 30px" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 9, marginBottom: 14,
          padding: "5px 14px", borderRadius: 999,
          background: "var(--card)", border: "1px solid var(--border)",
        }}>
          <span style={{
            display: "inline-block", width: 7, height: 7, borderRadius: "50%",
            background: "#10b981", animation: "livePulse 2s ease-in-out infinite",
          }} />
          <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.5px" }}>
            LIVE · {th ? "อัปเดต" : "updated"} {lastUpdated}
          </span>
        </div>

        <h1 style={{
          fontSize: "clamp(32px, 7vw, 60px)", fontWeight: 900, margin: "0 0 10px",
          letterSpacing: "-1.5px", lineHeight: 1.02,
          fontFamily: "var(--font-display, sans-serif)",
          background: "linear-gradient(90deg, #38bdf8, #10b981, #ff6d00, #d500f9)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          animation: "gradientShift 9s linear infinite",
        }}>
          Stock Radar Weekly
        </h1>

        <p style={{
          fontSize: "clamp(13px, 2.4vw, 16px)", color: "var(--muted)", margin: "0 auto",
          maxWidth: 560, lineHeight: 1.6,
        }}>
          {th ? (
            <>เลือก<strong style={{ color: "var(--text)" }}>ธาตุการลงทุน</strong>ของคุณ — แต่ละธาตุคือ thesis คนละแบบ
            บนเรดาร์เดียวกัน · institutional-grade analysis</>
          ) : (
            <>Pick your <strong style={{ color: "var(--text)" }}>investment element</strong> — each is a different thesis
            on one radar · institutional-grade analysis</>
          )}
        </p>

        {/* element legend line */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 0,
          margin: "20px auto 0", maxWidth: 360, height: 4, borderRadius: 4, overflow: "hidden",
        }}>
          <div style={{ flex: 1, background: "#38bdf8" }} />
          <div style={{ flex: 1, background: "#10b981" }} />
          <div style={{ flex: 1, background: "#ff6d00" }} />
          <div style={{ flex: 1, background: "#a16207", opacity: 0.4 }} />
        </div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 0,
          margin: "6px auto 0", maxWidth: 360,
          fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", letterSpacing: "1px",
        }}>
          <span style={{ flex: 1, textAlign: "center" }}>💧 {th ? "น้ำ" : "Water"}</span>
          <span style={{ flex: 1, textAlign: "center" }}>🌬️ {th ? "ลม" : "Air"}</span>
          <span style={{ flex: 1, textAlign: "center" }}>🔥 {th ? "ไฟ" : "Fire"}</span>
          <span style={{ flex: 1, textAlign: "center", opacity: 0.5 }}>🌍 {th ? "ดิน" : "Earth"}</span>
        </div>
      </div>

      {/* ── Element grid ─────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
        gap: 16, marginBottom: 28,
      }}>
        {elements.map((d) => <ElementCard key={d.element} d={d} th={th} />)}
      </div>

      {/* ── Secondary tools ──────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", letterSpacing: "1px", textTransform: "uppercase" }}>
          {th ? "เครื่องมือ" : "Tools"}
        </span>
        <Link href="/backtest" style={{
          fontSize: 12, textDecoration: "none", padding: "7px 14px", borderRadius: 9,
          background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)",
          fontFamily: "var(--font-mono, monospace)", fontWeight: 700,
        }}>
          📊 Backtest
        </Link>
        {isLocal && (
          <Link href="/journal" style={{
            fontSize: 12, textDecoration: "none", padding: "7px 14px", borderRadius: 9,
            background: "var(--card)", border: "1px solid var(--border)", color: "#f59e0b",
            fontFamily: "var(--font-mono, monospace)", fontWeight: 700,
          }}>
            📒 Journal
          </Link>
        )}
      </div>

    </div>
  );
}
