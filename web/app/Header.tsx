"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/LanguageContext";
import type { Lang } from "@/lib/i18n";
import { fetchCurrentUser, logout, loginUrl, type CurrentUser } from "@/lib/auth-client";

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

/* ── Compact radar mark for the header (matches the favicon) ──────────────────── */
function RadarBadge({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden style={{ borderRadius: 6, flexShrink: 0, display: "block" }}>
      <rect x="16" y="16" width="480" height="480" rx="112" fill="#0b1118" />
      <g fill="none" stroke="#2f8f5c" strokeOpacity="0.6" strokeWidth="10">
        <circle cx="256" cy="256" r="70" />
        <circle cx="256" cy="256" r="140" />
      </g>
      <g transform="rotate(-38 256 256)">
        <line x1="256" y1="256" x2="256" y2="86" stroke="#3fd07f" strokeWidth="12" strokeLinecap="round" />
      </g>
      <circle cx="330" cy="176" r="18" fill="#8ef0a8" />
      <circle cx="256" cy="256" r="16" fill="#3fd07f" />
    </svg>
  );
}

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

// ── Auth widget: avatar + logout dropdown, or a Login button ────────────────
type AuthState = CurrentUser | null | "loading";

function initials(user: CurrentUser): string {
  return (user.name?.trim()?.[0] ?? user.email[0]).toUpperCase();
}

const AVATAR_SIZE = 30;

function Avatar({ user, size, showImg, onError }: { user: CurrentUser; size: number; showImg: boolean; onError: () => void }) {
  return showImg ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={user.avatarUrl!}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={onError}
      style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "block", objectFit: "cover" }}
    />
  ) : (
    <span style={{
      width: size, height: size, borderRadius: "50%", display: "flex",
      background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", color: "#fff",
      alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.4), fontWeight: 800, flexShrink: 0,
    }}>
      {initials(user)}
    </span>
  );
}

// Mobile drawer: avatar + name + email + Logout all visible immediately —
// no click-through-a-dropdown once the hamburger is already open (that was
// three taps deep: hamburger → avatar → Logout). Desktop keeps the
// avatar-then-dropdown pattern in AuthWidget below.
function MobileProfileSection({ user, th, pathname }: { user: AuthState; th: boolean; pathname: string }) {
  const [imgError, setImgError] = useState(false);

  if (user === "loading") return null;

  if (user === null) {
    return (
      <a
        href={loginUrl(pathname)}
        style={{
          display: "block", textAlign: "center", fontSize: 14, fontWeight: 800, padding: "10px 12px", borderRadius: 8,
          background: "#10b981", color: "#fff", textDecoration: "none", fontFamily: "var(--font-mono, monospace)",
        }}
      >
        {th ? "เข้าสู่ระบบ" : "Login"}
      </a>
    );
  }

  const showImg = !!user.avatarUrl && !imgError;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Avatar user={user} size={36} showImg={showImg} onError={() => setImgError(true)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {user.name && (
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {user.name}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {user.email}
        </div>
      </div>
      <button
        onClick={() => logout()}
        style={{
          flexShrink: 0, padding: "6px 12px", borderRadius: 7, border: "1px solid var(--border)",
          background: "transparent", color: "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        {th ? "ออก" : "Logout"}
      </button>
    </div>
  );
}

function AuthWidget({ user, th, pathname }: { user: AuthState; th: boolean; pathname: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  if (user === "loading") return null;

  if (user === null) {
    return (
      // Plain <a>, not next/link's <Link> — this isn't an app route, it's a
      // rewrite-proxied redirect straight into the OAuth flow. Link's client-side
      // router tries to RSC-prefetch every href, which fails against this URL
      // ("Failed to fetch RSC payload") before falling back to a full navigation
      // anyway — skip the failed attempt and navigate directly.
      <a
        href={loginUrl(pathname)}
        className="srw-loginbtn"
        style={{
          fontSize: 12, fontWeight: 800, padding: "7px 16px", borderRadius: 9,
          background: "#10b981", color: "#fff", textDecoration: "none",
          fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.3px", whiteSpace: "nowrap",
          display: "inline-block", transition: "transform 0.15s, box-shadow 0.15s",
        }}
      >
        {th ? "เข้าสู่ระบบ" : "Login"}
      </a>
    );
  }

  const showImg = !!user.avatarUrl && !imgError;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setMenuOpen((o) => !o)}
        aria-expanded={menuOpen}
        aria-label={th ? "เมนูบัญชี" : "Account menu"}
        style={{
          display: "flex", alignItems: "center", background: "transparent",
          border: "none", padding: 0, cursor: "pointer", borderRadius: "50%", lineHeight: 0,
        }}
      >
        <Avatar user={user} size={AVATAR_SIZE} showImg={showImg} onError={() => setImgError(true)} />
      </button>
      {menuOpen && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, background: "var(--card)",
          border: "1px solid var(--border)", borderRadius: 8, padding: 4, minWidth: 180, zIndex: 20,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        }}>
          <div style={{ padding: "8px 10px 6px" }}>
            {user.name && (
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.name}
              </div>
            )}
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.email}
            </div>
          </div>
          <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />
          <button
            onClick={() => logout()}
            style={{
              display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 6,
              border: "none", background: "transparent", color: "var(--text)", cursor: "pointer",
              fontSize: 12, fontFamily: "var(--font-mono, monospace)", fontWeight: 700,
            }}
          >
            {th ? "ออกจากระบบ" : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
}

export function Header({ lastUpdated }: { lastUpdated: string }) {
  const [open, setOpen] = useState(false);
  const { lang, setLang } = useLang();
  const th = lang === "th";
  const pathname = usePathname();
  const [user, setUser] = useState<AuthState>("loading");

  useEffect(() => {
    fetchCurrentUser().then(setUser);
  }, []);

  return (
    <header style={{
      borderBottom: "1px solid var(--border)",
      background: "rgba(12,12,20,0.72)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      position: "sticky",
      top: 0,
      zIndex: 30,
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Link href="/" style={{ textDecoration: "none", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <RadarBadge size={24} />
          <span className="srw-logo" style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--text)", fontFamily: "var(--font-display, sans-serif)", whiteSpace: "nowrap" }}>
            Stock Playbook
          </span>
        </Link>

        {/* ── Desktop nav ── */}
        <div className="srw-desktop" style={{ alignItems: "center", gap: 14 }}>
          <nav style={{
            display: "flex", alignItems: "center", gap: 2,
            background: "#0a0a12", border: "1px solid var(--border)",
            borderRadius: 11, padding: 4,
          }}>
            {STRATEGY.map((s) => (
              <Link key={s.href} href={s.href} title={th ? s.titleTh : s.titleEn} className="srw-pill" style={{ ...gradLink, backgroundImage: s.grad }}>
                {s.label}
              </Link>
            ))}
          </nav>
          <Link href="/backtest" title="Backtest" className="srw-tool" style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none", fontFamily: "var(--font-mono, monospace)", fontWeight: 700, letterSpacing: "0.3px" }}>
            📊 Backtest
          </Link>
          <Link
            href="/journal"
            title={th ? "Journal — AI ตรวจแผนเทรด" : "Journal — AI plan validation"}
            className="srw-tool srw-tool-journal"
            style={{
              fontSize: 11, color: "#f59e0b", textDecoration: "none",
              fontFamily: "var(--font-mono, monospace)", fontWeight: 700, letterSpacing: "0.3px",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            📒 Journal <span className="srw-ai-spark" aria-hidden>✦</span>
          </Link>
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#10b981", animation: "livePulse 2s ease-in-out infinite", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{th ? "อัปเดต" : "Updated"} {lastUpdated}</span>
          <LangToggle lang={lang} setLang={setLang} />
          <AuthWidget user={user} th={th} pathname={pathname} />
        </div>

        {/* ── Mobile hamburger ── */}
        <button
          className="srw-burger"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          style={{
            background: "#0a0a12", border: "1px solid var(--border)", borderRadius: 9,
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
            <Link key={s.href} href={s.href} onClick={() => setOpen(false)} style={{
              ...gradLink, backgroundImage: s.grad, fontSize: 15, padding: "9px 6px",
            }}>
              {s.label}
            </Link>
          ))}
          <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
          <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: "var(--font-mono, monospace)", marginBottom: 2 }}>
            {th ? "เครื่องมือ" : "Tools"}
          </div>
          <Link href="/backtest" onClick={() => setOpen(false)} style={{ fontSize: 14, color: "var(--muted)", textDecoration: "none", fontFamily: "var(--font-mono, monospace)", fontWeight: 700, padding: "8px 6px" }}>
            📊 Backtest
          </Link>
          <Link
            href="/journal"
            onClick={() => setOpen(false)}
            style={{
              fontSize: 14, color: "#f59e0b", textDecoration: "none",
              fontFamily: "var(--font-mono, monospace)", fontWeight: 700, padding: "8px 6px",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            📒 Journal
            <span className="srw-ai-badge" aria-hidden>✦ AI</span>
          </Link>
          <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
          <div style={{ padding: "2px 6px" }}>
            <MobileProfileSection user={user} th={th} pathname={pathname} />
          </div>
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
        @media (max-width: 760px) {
          .srw-desktop { display: none; }
          .srw-burger  { display: flex; }
          .srw-logo    { font-size: 16px; }
        }

        .srw-pill:hover { background: rgba(255,255,255,0.04) !important; }
        .srw-tool { transition: color 0.15s; }
        .srw-tool:hover { color: var(--text) !important; }
        .srw-tool-journal:hover { color: #fbbf24 !important; }
        .srw-loginbtn:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(16,185,129,0.35); }

        /* Journal nav — a tiny spinning spark next to the plain text link
           hints there's an AI feature behind it, without a heavy filled
           button competing with the rest of the (mostly text-only) nav. */
        .srw-ai-spark {
          display: inline-block;
          font-size: 9px;
          color: #c4b5fd;
          animation: srwSparkPulse 2.4s ease-in-out infinite;
        }
        .srw-ai-badge {
          display: inline-flex;
          align-items: center;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.3px;
          color: #c4b5fd;
          background: rgba(139, 92, 246, 0.12);
          border: 1px solid rgba(139, 92, 246, 0.3);
          padding: 2px 6px;
          border-radius: 999px;
        }
        @keyframes srwSparkPulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50%      { transform: scale(1.25); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .srw-ai-spark { animation: none; }
        }
      `}</style>
    </header>
  );
}
