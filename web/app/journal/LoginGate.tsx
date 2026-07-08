import Link from "next/link";

const FEATURES: { icon: string; title: string; desc: string; accent: string }[] = [
  {
    icon: "🎯",
    title: "Plan-first logging",
    desc: "Lock in entry, TP1–3 and stop-loss the moment you open a position — before emotion can rewrite the plan.",
    accent: "#3b82f6",
  },
  {
    icon: "✦",
    title: "AI plan validation",
    desc: "Claude checks every open trade against live price + fresh news and gives a BUY / WATCH / CUT verdict on demand.",
    accent: "#8b5cf6",
  },
  {
    icon: "🚨",
    title: "Stop-loss alerts",
    desc: "Positions trading through your stop are flagged instantly — no more finding out three days late.",
    accent: "#ef4444",
  },
  {
    icon: "📊",
    title: "Win-rate & expectancy",
    desc: "Real P&L, plan adherence and win-rate broken down by catalyst type, so you know what's actually working.",
    accent: "#10b981",
  },
];

export function LoginGate() {
  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "56px 20px 64px" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 44 }}>
        <div className="lg-hero-icon" style={{
          width: 60, height: 60, margin: "0 auto 18px", borderRadius: 16,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
          background: "linear-gradient(145deg, rgba(245,158,11,0.18), rgba(139,92,246,0.14))",
          border: "1px solid rgba(245,158,11,0.35)",
        }}>
          📒
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14,
          fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase",
          color: "#c4b5fd", background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)",
          padding: "4px 10px", borderRadius: 999, fontFamily: "var(--font-mono, monospace)",
        }}>
          <span aria-hidden>✦</span> AI-powered
        </div>
        <h1 style={{
          fontSize: "clamp(24px, 4.5vw, 34px)", fontWeight: 900, margin: "0 0 12px",
          letterSpacing: "-0.6px", fontFamily: "var(--font-display, sans-serif)",
        }}>
          Trade Journal
        </h1>
        <p style={{
          fontSize: 14, color: "var(--muted)", maxWidth: 480, margin: "0 auto 28px",
          lineHeight: 1.6, fontFamily: "var(--font-mono, monospace)",
        }}>
          Log every trade plan, let live prices + Claude keep watch, and see — with real numbers —
          whether you actually stick to your own rules.
        </p>
        <Link
          href="/api/journal/auth/google"
          className="lg-cta"
          style={{
            display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 26px",
            borderRadius: 10, background: "#10b981", color: "#fff", fontWeight: 800, fontSize: 14,
            textDecoration: "none", fontFamily: "var(--font-mono, monospace)",
            boxShadow: "0 6px 24px rgba(16,185,129,0.35)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
            <path fill="#fff" d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.6-6 7.9-11.3 7.9-6.9 0-12.5-5.6-12.5-12.5S17.1 10.5 24 10.5c3.2 0 6.1 1.2 8.3 3.2l5.4-5.4C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.8-.4-4.5z" />
          </svg>
          Log in with Google
        </Link>
        <div style={{ marginTop: 12, fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
          Free · Google login only, no password to manage
        </div>
      </div>

      {/* Feature grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14,
      }}>
        {FEATURES.map((f) => (
          <div key={f.title} className="lg-feature-card" style={{
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
            padding: "18px 18px 20px", textAlign: "left",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 16, marginBottom: 12,
              background: `${f.accent}18`, border: `1px solid ${f.accent}35`, color: f.accent,
            }}>
              {f.icon}
            </div>
            <div style={{
              fontSize: 13, fontWeight: 800, marginBottom: 6, color: "var(--text)",
              fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.2px",
            }}>
              {f.title}
            </div>
            <div style={{
              fontSize: 11.5, color: "var(--muted)", lineHeight: 1.55,
              fontFamily: "var(--font-mono, monospace)",
            }}>
              {f.desc}
            </div>
          </div>
        ))}
      </div>

      <p style={{
        textAlign: "center", marginTop: 32, fontSize: 10.5, color: "var(--muted)",
        fontFamily: "var(--font-mono, monospace)", opacity: 0.75,
      }}>
        Not financial advice · Your trades are private to your account
      </p>

      <style>{`
        .lg-hero-icon {
          animation: lgFloat 3.5s ease-in-out infinite;
        }
        @keyframes lgFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .lg-cta {
          transition: transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.18s ease;
        }
        .lg-cta:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 10px 32px rgba(16,185,129,0.5);
        }
        .lg-feature-card {
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
        }
        .lg-feature-card:hover {
          transform: translateY(-3px);
          border-color: var(--border-bright, #334155);
          background: rgba(255,255,255,0.02);
        }
      `}</style>
    </div>
  );
}
