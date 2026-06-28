"use client";

import { useState } from "react";
import { useLang } from "@/lib/LanguageContext";
import type { Lang } from "@/lib/i18n";

const STRATEGY = [
  { href: "/dca",      label: "💧 DCA",      grad: "linear-gradient(90deg, #38bdf8, #3b82f6)", titleEn: "Water · Quality-core · long-term accumulate", titleTh: "ธาตุน้ำ · Quality-core · ถือยาว สะสม" },
  { href: "/catalyst", label: "🌬️ Catalyst", grad: "linear-gradient(90deg, #10b981, #34d399)", titleEn: "Air · Catalyst · near-term event plays",     titleTh: "ธาตุลม · Catalyst · เล่นตาม event ระยะสั้น" },
  { href: "/turbo",    label: "🔥 Turbo",    grad: "linear-gradient(90deg, #ff6d00, #d500f9)", titleEn: "Fire · Moonshot · 300%+ speculative",       titleTh: "ธาตุไฟ · Moonshot · เก็งกำไร 300%+" },
];

const gradLink: React.CSSProperties = {
  fontSize: 11, textDecoration: "none", padding: "5px 10px", borderRadius: 7,
  fontFamily: "var(--font-mono, monospace)", fontWeight: 700, letterSpacing: "0.3px",
  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
};

// ── EN/TH segmented toggle ───────────────────────────────────────────────────
function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 1,
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 2,
    }}>
      {(["en", "th"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.5px",
            fontFamily: "var(--font-mono, monospace)", cursor: "pointer",
            padding: "3px 8px", borderRadius: 6, border: "none",
            background: lang === l ? "#3b82f6" : "transparent",
            color: lang === l ? "#fff" : "var(--muted)",
            transition: "background .15s, color .15s",
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function Header({ lastUpdated, isLocal }: { lastUpdated: string; isLocal: boolean }) {
  const [open, setOpen] = useState(false);
  const { lang, setLang } = useLang();
  const th = lang === "th";

  return (
    <header style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)", position: "relative" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <a href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
          <span className="srw-logo" style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--text)", fontFamily: "var(--font-display, sans-serif)", whiteSpace: "nowrap" }}>
            📡 Stock Radar Weekly
          </span>
        </a>

        {/* ── Desktop nav ── */}
        <div className="srw-desktop" style={{ alignItems: "center", gap: 14 }}>
          <nav style={{
            display: "flex", alignItems: "center", gap: 2,
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 3,
          }}>
            {STRATEGY.map((s) => (
              <a key={s.href} href={s.href} title={th ? s.titleTh : s.titleEn} style={{ ...gradLink, backgroundImage: s.grad }}>
                {s.label}
              </a>
            ))}
          </nav>
          <a href="/backtest" title="Backtest" style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none", fontFamily: "var(--font-mono, monospace)", fontWeight: 700, letterSpacing: "0.3px" }}>
            📊 Backtest
          </a>
          {isLocal && (
            <a href="/journal" title="Journal" style={{ fontSize: 11, color: "#f59e0b", textDecoration: "none", fontFamily: "var(--font-mono, monospace)", fontWeight: 700, letterSpacing: "0.3px" }}>
              📒 Journal
            </a>
          )}
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#10b981", animation: "livePulse 2s ease-in-out infinite", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{th ? "อัปเดต" : "Updated"} {lastUpdated}</span>
          <LangToggle lang={lang} setLang={setLang} />
        </div>

        {/* ── Mobile hamburger ── */}
        <button
          className="srw-burger"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          style={{
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 9,
            width: 38, height: 34, cursor: "pointer", padding: 0,
            alignItems: "center", justifyContent: "center", color: "var(--text)",
          }}
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M4 4 L14 14 M14 4 L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
              <path d="M1 1 H17 M1 7 H17 M1 13 H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Mobile dropdown panel ── */}
      {open && (
        <div className="srw-menu" style={{
          borderTop: "1px solid var(--border)", background: "var(--card)",
          padding: "10px 16px 16px", display: "flex", flexDirection: "column", gap: 6,
        }}>
          <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: "var(--font-mono, monospace)", margin: "4px 0 2px" }}>
            {th ? "ธาตุการลงทุน" : "Investment elements"}
          </div>
          {STRATEGY.map((s) => (
            <a key={s.href} href={s.href} onClick={() => setOpen(false)} style={{
              ...gradLink, backgroundImage: s.grad, fontSize: 15, padding: "9px 6px",
            }}>
              {s.label}
            </a>
          ))}
          <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
          <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: "var(--font-mono, monospace)", marginBottom: 2 }}>
            {th ? "เครื่องมือ" : "Tools"}
          </div>
          <a href="/backtest" onClick={() => setOpen(false)} style={{ fontSize: 14, color: "var(--muted)", textDecoration: "none", fontFamily: "var(--font-mono, monospace)", fontWeight: 700, padding: "8px 6px" }}>
            📊 Backtest
          </a>
          {isLocal && (
            <a href="/journal" onClick={() => setOpen(false)} style={{ fontSize: 14, color: "#f59e0b", textDecoration: "none", fontFamily: "var(--font-mono, monospace)", fontWeight: 700, padding: "8px 6px" }}>
              📒 Journal
            </a>
          )}
          <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#10b981", animation: "livePulse 2s ease-in-out infinite" }} />
              <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{th ? "อัปเดต" : "Updated"} {lastUpdated}</span>
            </span>
            <LangToggle lang={lang} setLang={setLang} />
          </div>
        </div>
      )}

      {/* Responsive switch — desktop nav vs hamburger */}
      <style>{`
        .srw-desktop { display: flex; }
        .srw-burger  { display: none; }
        @media (max-width: 720px) {
          .srw-desktop { display: none; }
          .srw-burger  { display: flex; }
          .srw-logo    { font-size: 16px; }
        }
      `}</style>
    </header>
  );
}
