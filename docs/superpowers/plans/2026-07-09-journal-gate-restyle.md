# Journal Login Gate Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `web/app/journal/LoginGate.tsx` up to the mockup: ambient background,
larger icon with a pulsing ring, gradient-clipped title, gradient/shine-sweep CTA, trust
pips row, accent-barred feature cards, and — the most significant gap — full EN/TH i18n
support matching every other page in the app.

**Architecture:** Single existing client component, inline styles + one trailing
`<style>` tag (existing file pattern). Given how much of the target differs from the
current file, this plan replaces the whole file body in one step rather than many small
find/replace edits, which would be fragile against a file this different from its target.

**Tech Stack:** Next.js 15 App Router, React client component, inline styles,
`useLang()`/`LanguageContext`, `next/link`.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-09-journal-gate-restyle-design.md`.
- Do NOT touch `Header.tsx`, `MarketTicker.tsx`, `layout.tsx`, `Landing.tsx`, or any
  dashboard file (Phases 1-3, already done).
- Do NOT change the auth mechanism — CTA must still be a plain `<Link href="/api/journal/auth/google">`,
  not a fake demo toggle button. Do not touch `fetchCurrentUser()`/`auth-client.ts`/
  `JournalContent.tsx`.
- No new npm dependencies.
- No automated test suite for this file. Verification = `npm run build` + curl against a
  live dev server (inline styles render literally into HTML) for markup/copy/animation
  rule presence.

---

## Task 1: Rewrite `LoginGate.tsx` to match the mockup, with full EN/TH i18n

**Files:**
- Modify: `web/app/journal/LoginGate.tsx` (full-file replacement)

**Interfaces:**
- Consumes: `useLang()` from `@/lib/LanguageContext` (already used identically by every
  other component in this app — same import path, same `{ lang }` destructure, same
  `const th = lang === "th"` convention).
- Produces: `LoginGate()` — same zero-argument named export signature as today, so its
  one consumer (`web/app/journal/page.tsx`, rendering `<LoginGate />` when logged out) is
  unaffected.

- [ ] **Step 1: Replace the entire file content**

Replace the full content of `web/app/journal/LoginGate.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { useLang } from "@/lib/LanguageContext";

interface Feature {
  icon: string;
  titleEn: string;
  titleTh: string;
  descEn: string;
  descTh: string;
  accent: string;
}

const FEATURES: Feature[] = [
  {
    icon: "🎯",
    titleEn: "Plan-first logging",
    titleTh: "บันทึกแผนก่อนเทรด",
    descEn: "Lock in entry, TP1–3 and stop-loss the moment you open a position — before emotion can rewrite the plan.",
    descTh: "ล็อก entry, TP1-3 และ stop-loss ทันทีที่เปิดโพซิชัน — ก่อนอารมณ์จะเปลี่ยนแผน",
    accent: "#3b82f6",
  },
  {
    icon: "✦",
    titleEn: "AI plan validation",
    titleTh: "AI ตรวจสอบแผน",
    descEn: "Claude checks every open trade against live price + fresh news and gives a BUY / WATCH / CUT verdict on demand.",
    descTh: "Claude ตรวจทุกโพซิชันเทียบราคาจริง + ข่าวล่าสุด แล้วให้คำตัดสิน BUY / WATCH / CUT",
    accent: "#8b5cf6",
  },
  {
    icon: "🚨",
    titleEn: "Stop-loss alerts",
    titleTh: "แจ้งเตือน Stop-loss",
    descEn: "Positions trading through your stop are flagged instantly — no more finding out three days late.",
    descTh: "โพซิชันที่ราคาทะลุ stop จะถูกแจ้งเตือนทันที ไม่ต้องมารู้ทีหลังสามวัน",
    accent: "#ef4444",
  },
  {
    icon: "📊",
    titleEn: "Win-rate & expectancy",
    titleTh: "Win-rate & Expectancy",
    descEn: "Real P&L, plan adherence and win-rate broken down by catalyst type, so you know what's actually working.",
    descTh: "P&L จริง ความมีวินัยตามแผน และ win-rate แยกตามประเภท catalyst",
    accent: "#10b981",
  },
];

const PIPS: { icon: string; en: string; th: string }[] = [
  { icon: "🔒", en: "Private", th: "ส่วนตัว" },
  { icon: "⚡", en: "Instant", th: "เห็นผลทันที" },
  { icon: "🤖", en: "AI-checked", th: "ตรวจโดย AI" },
];

export function LoginGate() {
  const { lang } = useLang();
  const th = lang === "th";

  return (
    <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "60px 20px", isolation: "isolate" }}>

      {/* ── Ambient background: glow + static rings ─────────────────── */}
      <div aria-hidden style={{
        position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)",
        width: 640, height: 520, pointerEvents: "none", zIndex: -1,
        background: [
          "radial-gradient(ellipse at center, rgba(245,158,11,0.16), transparent 60%)",
          "radial-gradient(ellipse 60% 60% at 30% 70%, rgba(139,92,246,0.13), transparent 65%)",
        ].join(", "),
      }} />
      <div aria-hidden style={{
        position: "absolute", top: "8%", left: "50%", transform: "translate(-50%, 0)",
        width: 420, height: 420, pointerEvents: "none", zIndex: -1, opacity: 0.35,
      }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 200, height: 200, border: "1px solid rgba(245,158,11,0.28)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 340, height: 340, border: "1px solid rgba(245,158,11,0.28)", borderRadius: "50%" }} />
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: 44 }}>
        <div style={{ position: "relative", width: 84, height: 84, margin: "0 auto 20px" }}>
          <div className="lg-icon-ring" style={{
            position: "absolute", inset: -10, borderRadius: 24,
            border: "1px solid rgba(245,158,11,0.35)",
          }} />
          <div className="lg-hero-icon" style={{
            position: "relative", width: 84, height: 84, borderRadius: 20,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38,
            background: "linear-gradient(150deg, rgba(245,158,11,0.24), rgba(139,92,246,0.16))",
            border: "1px solid rgba(245,158,11,0.4)",
            boxShadow: "0 16px 44px rgba(245,158,11,0.18)",
          }}>
            📒
          </div>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16,
          fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase",
          color: "#c4b5fd", background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.32)",
          padding: "5px 12px", borderRadius: 999, fontFamily: "var(--font-mono, monospace)",
          whiteSpace: "nowrap",
        }}>
          <span aria-hidden>✦</span> {th ? "ขับเคลื่อนด้วย AI" : "AI-powered"}
        </div>
        <h1 style={{
          fontSize: "clamp(30px, 5.5vw, 46px)", fontWeight: 800, margin: "0 0 14px",
          letterSpacing: "-1px", fontFamily: "var(--font-display, sans-serif)",
          background: "linear-gradient(96deg, #fbbf24, #fb923c 55%, #c4b5fd)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Trade Journal
        </h1>
        <p style={{
          fontSize: 14, color: "var(--muted)", maxWidth: 500, margin: "0 auto 30px",
          lineHeight: 1.65, fontFamily: "var(--font-mono, monospace)",
        }}>
          {th
            ? "บันทึกทุกแผนเทรด ให้ราคาจริง + Claude คอยจับตา และดูด้วยตัวเลขจริงว่าคุณทำตามกฎของตัวเองแค่ไหน"
            : "Log every trade plan, let live prices + Claude keep watch, and see — with real numbers — whether you actually stick to your own rules."}
        </p>
        <Link
          href="/api/journal/auth/google"
          className="lg-cta"
          style={{
            position: "relative", display: "inline-flex", alignItems: "center", gap: 10,
            padding: "15px 30px", borderRadius: 12,
            background: "linear-gradient(135deg, #10b981, #0ea86f)", color: "#04120c",
            fontWeight: 800, fontSize: 15, textDecoration: "none",
            fontFamily: "var(--font-mono, monospace)",
            boxShadow: "0 10px 32px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
            overflow: "hidden",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
            <path fill="#04120c" d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.6-6 7.9-11.3 7.9-6.9 0-12.5-5.6-12.5-12.5S17.1 10.5 24 10.5c3.2 0 6.1 1.2 8.3 3.2l5.4-5.4C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.8-.4-4.5z" />
          </svg>
          {th ? "เข้าสู่ระบบด้วย Google" : "Log in with Google"}
        </Link>
        <div style={{ marginTop: 14, fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
          {th ? "ฟรี · เข้าสู่ระบบด้วย Google เท่านั้น ไม่ต้องจำรหัสผ่าน" : "Free · Google login only, no password to manage"}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          {PIPS.map((p) => (
            <span key={p.en} style={{
              fontFamily: "var(--font-mono, monospace)", fontSize: 10, fontWeight: 700,
              color: "var(--muted)", background: "var(--card)", border: "1px solid var(--border)",
              padding: "5px 12px", borderRadius: 999,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              {p.icon} {th ? p.th : p.en}
            </span>
          ))}
        </div>
      </div>

      {/* ── Feature grid ─────────────────────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14,
      }}>
        {FEATURES.map((f) => (
          <div
            key={f.titleEn}
            style={{
              position: "relative",
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
              padding: "20px 20px 22px", textAlign: "left", overflow: "hidden",
              transition: "transform 0.2s cubic-bezier(0.22,1,0.36,1), border-color 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = "translateY(-5px)";
              el.style.boxShadow = `0 14px 34px ${f.accent}29`;
              el.style.borderColor = `${f.accent}45`;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = "translateY(0)";
              el.style.boxShadow = "none";
              el.style.borderColor = "var(--border)";
            }}
          >
            <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: f.accent, opacity: 0.9 }} />
            <div style={{
              width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 17, marginBottom: 13,
              background: `${f.accent}18`, border: `1px solid ${f.accent}35`, color: f.accent,
            }}>
              {f.icon}
            </div>
            <div style={{
              fontSize: 14, fontWeight: 800, marginBottom: 6, color: "var(--text)",
              fontFamily: "var(--font-display, sans-serif)", letterSpacing: "-0.2px",
            }}>
              {th ? f.titleTh : f.titleEn}
            </div>
            <div style={{
              fontSize: 12, color: "var(--muted)", lineHeight: 1.6,
              fontFamily: "var(--font-mono, monospace)",
            }}>
              {th ? f.descTh : f.descEn}
            </div>
          </div>
        ))}
      </div>

      <p style={{
        textAlign: "center", marginTop: 38, fontSize: 10.5, color: "var(--muted)",
        fontFamily: "var(--font-mono, monospace)", opacity: 0.8,
      }}>
        {th ? "ไม่ใช่คำแนะนำการลงทุน · ข้อมูลเทรดของคุณเป็นส่วนตัวเฉพาะบัญชีคุณ" : "Not financial advice · Your trades are private to your account"}
      </p>

      <style>{`
        .lg-hero-icon {
          animation: lgFloat 3.6s ease-in-out infinite;
        }
        @keyframes lgFloat {
          0%, 100% { transform: translateY(0) rotate(0); }
          50%      { transform: translateY(-8px) rotate(-2deg); }
        }
        .lg-icon-ring {
          animation: lgRingPulse 2.6s ease-in-out infinite;
        }
        @keyframes lgRingPulse {
          0%, 100% { transform: scale(1);    opacity: 0.5;  }
          50%      { transform: scale(1.08); opacity: 0.15; }
        }
        .lg-cta {
          transition: transform 0.2s cubic-bezier(0.34, 1.6, 0.64, 1), box-shadow 0.2s;
        }
        .lg-cta:hover {
          transform: translateY(-3px) scale(1.03);
          box-shadow: 0 16px 44px rgba(16,185,129,0.55), inset 0 1px 0 rgba(255,255,255,0.3);
        }
        .lg-cta::after {
          content: "";
          position: absolute; top: 0; left: -60%;
          width: 40%; height: 100%;
          background: linear-gradient(115deg, transparent, rgba(255,255,255,0.5), transparent);
          animation: lgShine 3s ease-in-out infinite;
        }
        @keyframes lgShine {
          0%, 20%   { left: -60%; }
          60%, 100% { left: 130%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lg-hero-icon, .lg-icon-ring, .lg-cta::after { animation: none; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd web && npm run build`
Expected: build succeeds with no new type/lint errors.

- [ ] **Step 3: Manual check**

Start `npm run dev`, load `/journal` while logged out, confirm: a soft amber/purple glow
and two faint static rings sit behind the hero; the 📒 icon is visibly larger with a
pulsing outline ring around it and a gentle float+tilt; the "AI-powered" badge doesn't
wrap to two lines; "Trade Journal" renders as a gradient (amber→orange→purple) not plain
text; the CTA button is a green→teal gradient with dark text and a continuous diagonal
shine sweep, and lifts/brightens further on hover; a row of 3 small pills ("🔒 Private",
"⚡ Instant", "🤖 AI-checked") appears below the trust line; each feature card has a thin
colored top accent stripe matching its icon color and glows in that color on hover.
Toggle EN/TH in the header and confirm every string on the page (title stays "Trade
Journal" in both — mockup keeps it untranslated — badge, subhead, CTA label, trust line,
all 3 pips, all 4 feature titles/descriptions, footer line) switches to the correct Thai
text.

- [ ] **Step 4: Commit**

```bash
git add web/app/journal/LoginGate.tsx
git commit -m "style: restyle Journal login gate to match mockup, add EN/TH i18n"
```

---

## Task 2: Full manual QA pass

**Files:** none modified — verification only.

- [ ] **Step 1: Start the dev server**

Run: `cd web && npm run dev`

- [ ] **Step 2: Walk the design spec's Testing checklist**

Confirm on `/journal` (logged out): ambient glow/rings render, icon is 84px with a
pulsing ring, badge doesn't wrap, title is gradient-clipped, CTA has the gradient/dark-
text/shine treatment and hover lift, trust pips render (exactly 3), feature cards show
top accent bars and colored hover glow, and EN/TH toggle correctly switches every string
on the page. Also confirm the CTA still navigates to `/api/journal/auth/google` (check
the rendered `href` attribute — don't need to complete a real Google OAuth flow).

- [ ] **Step 3: Stop the dev server**

Kill the `npm run dev` process once verification is complete.

- [ ] **Step 4: Mark Phase 4 complete**

No commit needed for this task. This is the last phase of `design_handoff_stock_playbook`
— after this, proceed to the final whole-branch review for the phase, then report overall
completion of all 4 phases.
