"use client";

import Link from "next/link";
import { useLang } from "@/lib/LanguageContext";

interface ElementDef {
  href: string | null;
  element: string;
  glyph: string;
  feature: string;
  tagline: string;
  risk: string;
  horizon: string;
  count: number | null;
  c1: string;
  c2: string;
  glow: string;
  ghost?: boolean;
}

function ElementAmbient({ d }: { d: ElementDef }) {
  if (d.ghost) return null;

  if (d.element === "WATER") {
    return (
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: 0, left: "-5%", right: "-5%",
          height: 72,
          background: `linear-gradient(to top, ${d.c1}44, ${d.c2}1a, transparent)`,
          animation: "waterWave 3.8s ease-in-out infinite",
          transformOrigin: "50% 100%",
          zIndex: -1,
          pointerEvents: "none",
        }}
      />
    );
  }

  if (d.element === "AIR") {
    return (
      <>
        {([0, 1, 2] as const).map((i) => (
          <div
            key={i}
            aria-hidden
            style={{
              position: "absolute",
              top: `${16 + i * 24}%`,
              left: 0, right: 0,
              height: i === 1 ? 2 : 1,
              background: `linear-gradient(90deg, transparent 0%, ${d.c1}dd 25%, ${d.c1}99 60%, transparent 100%)`,
              animation: `windStreak ${3.2 + i * 0.7}s ease-in-out infinite`,
              animationDelay: `${i * 1.2}s`,
              zIndex: -1,
              pointerEvents: "none",
              borderRadius: 1,
            }}
          />
        ))}
      </>
    );
  }

  if (d.element === "FIRE") {
    return (
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          height: 90,
          background: `linear-gradient(to top, #ff6d0058 0%, #d500f92a 55%, transparent 100%)`,
          animation: "flameLick 1.9s ease-in-out infinite",
          zIndex: -1,
          pointerEvents: "none",
        }}
      />
    );
  }

  return null;
}

function ElementCard({ d, th, idx }: { d: ElementDef; th: boolean; idx: number }) {
  const inner = (
    <div
      style={{
        position: "relative",
        height: "100%",
        isolation: "isolate",
        background: d.ghost ? "rgba(255,255,255,0.015)" : "var(--card)",
        border: "1px solid var(--border)",
        borderTop: `2px solid ${d.ghost ? "#3a3a2a" : d.c1}`,
        borderRadius: 16,
        padding: "22px 20px 18px",
        cursor: d.ghost ? "default" : "pointer",
        overflow: "hidden",
        transition: "transform .22s, box-shadow .22s, border-color .22s",
        opacity: d.ghost ? 0.55 : 1,
        animation: "cardEntrance 0.55s cubic-bezier(0.22,1,0.36,1) both",
        animationDelay: `${idx * 80}ms`,
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
      {/* Element-specific ambient atmosphere */}
      <ElementAmbient d={d} />

      {/* element glow wash — top right corner */}
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
          letterSpacing: "0.5px", fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap",
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
}: {
  waterCount: number;
  airCount: number;
  fireCount: number;
  lastUpdated: string;
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
      tagline: th ? "Rare Earth · โลหะมีค่า"
                  : "Rare Earth Elements, Precious Metals",
      risk: "—", horizon: "—", count: null,
      c1: "#a16207", c2: "#84cc16", glow: "rgba(161,98,7,0.0)", ghost: true,
    },
  ];

  return (
    <div style={{ position: "relative" }}>

      {/* ── Hero: ambient glow + calm title ─────────────────────────── */}
      <div style={{
        textAlign: "center",
        padding: "52px 0 40px",
        position: "relative",
        overflow: "hidden",
        isolation: "isolate",
      }}>
        {/* Ambient glow — three soft radial gradients, no icon or animation */}
        <div aria-hidden style={{
          position: "absolute", top: "-8%", left: "50%",
          transform: "translateX(-50%)",
          width: 900, height: 520, pointerEvents: "none", zIndex: -1,
          background: [
            "radial-gradient(ellipse 55% 60% at 30% 40%, rgba(16,185,129,0.10), transparent 65%)",
            "radial-gradient(ellipse 55% 60% at 70% 55%, rgba(56,189,248,0.08), transparent 65%)",
            "radial-gradient(ellipse 40% 50% at 50% 70%, rgba(251,146,60,0.07), transparent 65%)",
          ].join(", "),
        }} />

        {/* Hero content */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 9, marginBottom: 18,
            padding: "5px 14px", borderRadius: 999,
            background: "var(--card)", border: "1px solid var(--border)",
            animation: "fadeInUp 0.4s ease both",
            whiteSpace: "nowrap",
          }}>
            <span style={{
              display: "inline-block", width: 7, height: 7, borderRadius: "50%",
              background: "#10b981", animation: "livePulse 2s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.5px" }}>
              LIVE · {th ? "อัปเดต" : "updated"} {lastUpdated}
            </span>
          </div>

          {/* Calm static element-spectrum title (no shimmer) */}
          <h1 style={{
            fontSize: "clamp(34px, 6.5vw, 58px)", fontWeight: 800, margin: "0 0 12px",
            letterSpacing: "-1.6px", lineHeight: 1.02,
            fontFamily: "var(--font-display, sans-serif)",
            background: "linear-gradient(96deg, #7dd3fc, #34d399 42%, #fb923c 74%, #e879f9)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Stock Playbook
          </h1>

          <p style={{
            fontSize: "clamp(14px, 2.3vw, 16.5px)", color: "var(--muted)", margin: "0 auto",
            maxWidth: 568, lineHeight: 1.62,
            animation: "fadeInUp 0.45s ease both",
            animationDelay: "0.15s",
          }}>
            {th ? (
              <>เลือก<strong style={{ color: "var(--text)" }}>ธาตุการลงทุน</strong>ของคุณ — แต่ละธาตุคือ thesis คนละแบบ
              ในเพลย์บุ๊กเดียวกัน · institutional-grade analysis</>
            ) : (
              <>Pick your <strong style={{ color: "var(--text)" }}>investment element</strong> — each is a different thesis
              in one playbook · institutional-grade analysis</>
            )}
          </p>
        </div>
      </div>

      {/* ── Element grid ─────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
        gap: 16, marginBottom: 28,
      }}>
        {elements.map((d, idx) => <ElementCard key={d.element} d={d} th={th} idx={idx} />)}
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
        <Link href="/journal" style={{
          fontSize: 12, textDecoration: "none", padding: "7px 14px", borderRadius: 9,
          background: "var(--card)", border: "1px solid var(--border)", color: "#f59e0b",
          fontFamily: "var(--font-mono, monospace)", fontWeight: 700,
        }}>
          📒 Journal
        </Link>
      </div>

    </div>
  );
}
