# Landing Page Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retune `web/app/Landing.tsx` to match `design_handoff_stock_playbook`: remove the
superseded radar-rings hero centerpiece in favor of the mockup's ambient-glow-only hero,
fix subhead copy that still says "on one radar" (explicitly corrected away from per the
handoff), add missing pip-dot decorations to element cards, tune several spacing/opacity
values to match the mockup exactly, and add real hover feedback to the tools row.

**Architecture:** Single existing client component file, inline-style React, following the
same pattern `Header.tsx` already established in Phase 1 (className + trailing `<style>`
tag for anything needing `:hover`). No new files, no new components.

**Tech Stack:** Next.js 15 App Router, React client component, inline styles,
`useLang()`/`LanguageContext`.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-09-landing-restyle-design.md` — every task
  implements one numbered item from that spec's "Current state vs. target" section.
- Do NOT touch `web/app/Header.tsx`, `MarketTicker.tsx`, or `layout.tsx` (Phase 1, done).
- Do NOT touch `<h1>Stock Playbook</h1>`'s gradient/typography — already byte-identical to
  spec.
- Do NOT touch the three `ElementAmbient` treatments (water/air/fire) — already correct.
- Do NOT use `globals.css`'s `.radar-rings`/`.radar-hero-icon` classes — they target the
  old, superseded hero design this phase is removing, not the target design.
- No new npm dependencies.
- No automated test suite for this file. Verification per task = `npm run build` +
  (for non-interactive markup/copy) a curl check against a live dev server, same method
  used successfully in Phase 1 since this file also uses inline styles that render
  literally into HTML.

---

## Task 1: Hero centerpiece removal + badge nowrap + subhead copy fix

**Files:**
- Modify: `web/app/Landing.tsx` (delete `RadarMark` function, replace rings/sweep div with
  `.hglow` ambient, add `whiteSpace: "nowrap"` to badge, fix EN+TH subhead copy)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by later tasks (Tasks 2-3 touch different, non-overlapping
  regions of the same file).

- [ ] **Step 1: Delete the dead `RadarMark` function**

`RadarMark` is defined but never invoked anywhere in `Landing.tsx` (confirmed via grep —
only its definition line matches). Find this entire block (starts right after the
`ElementDef` interface's closing brace and blank line, ends with a blank line right before
`function ElementAmbient`):

```tsx
/* ── Radar mark: navy tile, rings, green sweep, four element blips ──────────── */
function RadarMark({ size = 96 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden
      style={{ display: "block", filter: "drop-shadow(0 8px 30px rgba(16,185,129,0.28))" }}
    >
      <defs>
        <linearGradient id="rmSg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8ef0a8" />
          <stop offset="1" stopColor="#22b866" />
        </linearGradient>
        <radialGradient id="rmSwp" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#3fd07f" stopOpacity="0.85" />
          <stop offset="1" stopColor="#3fd07f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rmBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#111a24" />
          <stop offset="1" stopColor="#080c12" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#rmBg)" />
      <rect x="16.5" y="16.5" width="479" height="479" rx="111.5" fill="none" stroke="#28e07f" strokeOpacity="0.18" strokeWidth="3" />
      <g fill="none" stroke="#2f8f5c" strokeOpacity="0.55" strokeWidth="8">
        <circle cx="256" cy="256" r="56" />
        <circle cx="256" cy="256" r="112" />
        <circle cx="256" cy="256" r="168" />
      </g>
      <g transform="rotate(-38 256 256)">
        <path d="M256 256 L256 76 A180 180 0 0 1 424 232 Z" fill="url(#rmSwp)" />
        <line x1="256" y1="256" x2="256" y2="72" stroke="url(#rmSg)" strokeWidth="10" strokeLinecap="round" />
      </g>
      <circle cx="300" cy="140" r="16" fill="#4aa8f0" />
      <circle cx="368" cy="232" r="16" fill="#3fd07f" />
      <circle cx="216" cy="372" r="16" fill="#ff7a3c" />
      <circle cx="140" cy="300" r="16" fill="#c08a4a" />
      <circle cx="256" cy="256" r="16" fill="url(#rmSg)" />
    </svg>
  );
}

```

Delete it entirely (replace with nothing/empty string) — the blank line that was already
above it (after the `ElementDef` interface) remains, giving correct one-blank-line spacing
before `function ElementAmbient`.

- [ ] **Step 2: Replace the rings/sweep decorative div with the ambient-glow div**

Find:

```tsx
      {/* ── Hero: radar centerpiece + calm title ─────────────────────── */}
      <div style={{
        textAlign: "center",
        padding: "52px 0 40px",
        position: "relative",
        overflow: "hidden",
        isolation: "isolate",
      }}>
        {/* Radar rings + rotating sweep — behind the mark */}
        <div aria-hidden style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -56%)",
          width: 520, height: 520, opacity: 0.5, pointerEvents: "none", zIndex: 0,
        }}>
          {[180, 320, 460].map((s) => (
            <div key={s} style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: s, height: s, borderRadius: "50%",
              border: "1px solid rgba(47,143,92,0.32)",
            }} />
          ))}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            width: 260, height: 260, transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: "conic-gradient(from 0deg, rgba(63,208,127,0.28), transparent 42%)",
            animation: "radarSweep 7s linear infinite",
          }} />
        </div>

        {/* Hero content — above rings */}
        <div style={{ position: "relative", zIndex: 1 }}>
```

Replace with:

```tsx
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
```

- [ ] **Step 3: Add `whiteSpace: "nowrap"` to the LIVE badge**

Find:

```tsx
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 9, marginBottom: 18,
            padding: "5px 14px", borderRadius: 999,
            background: "var(--card)", border: "1px solid var(--border)",
            animation: "fadeInUp 0.4s ease both",
          }}>
```

Replace with:

```tsx
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 9, marginBottom: 18,
            padding: "5px 14px", borderRadius: 999,
            background: "var(--card)", border: "1px solid var(--border)",
            animation: "fadeInUp 0.4s ease both",
            whiteSpace: "nowrap",
          }}>
```

- [ ] **Step 4: Fix the subhead copy (both languages)**

Find:

```tsx
            {th ? (
              <>เลือก<strong style={{ color: "var(--text)" }}>ธาตุการลงทุน</strong>ของคุณ — แต่ละธาตุคือ thesis คนละแบบ
              บนเรดาร์เดียวกัน · institutional-grade analysis</>
            ) : (
              <>Pick your <strong style={{ color: "var(--text)" }}>investment element</strong> — each is a different thesis
              on one radar · institutional-grade analysis</>
            )}
```

Replace with:

```tsx
            {th ? (
              <>เลือก<strong style={{ color: "var(--text)" }}>ธาตุการลงทุน</strong>ของคุณ — แต่ละธาตุคือ thesis คนละแบบ
              ในเพลย์บุ๊กเดียวกัน · institutional-grade analysis</>
            ) : (
              <>Pick your <strong style={{ color: "var(--text)" }}>investment element</strong> — each is a different thesis
              in one playbook · institutional-grade analysis</>
            )}
```

- [ ] **Step 5: Verify it builds**

Run: `cd web && npm run build`
Expected: build succeeds with no new type/lint errors (also confirms no leftover
references to the deleted `RadarMark` function).

- [ ] **Step 6: Manual check**

Start `npm run dev`, load `/`, confirm: no large ring/sweep animation behind the hero
text, a subtle soft-glow background is visible instead, the LIVE badge doesn't wrap, and
the subhead reads "...in one playbook..." (EN) / "...ในเพลย์บุ๊กเดียวกัน..." (TH, toggle
the language switch to check).

- [ ] **Step 7: Commit**

```bash
git add web/app/Landing.tsx
git commit -m "style: remove superseded radar hero centerpiece, fix subhead copy"
```

---

## Task 2: Element grid tuning + pip dots

**Files:**
- Modify: `web/app/Landing.tsx` (`ElementCard` component and the grid container)

**Interfaces:**
- Consumes: nothing new from Task 1.
- Produces: nothing consumed by Task 3.

- [ ] **Step 1: Widen the grid's minmax value**

Find:

```tsx
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
        gap: 16, marginBottom: 28,
      }}>
```

Replace with:

```tsx
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(232px, 1fr))",
        gap: 16, marginBottom: 28,
      }}>
```

- [ ] **Step 2: Retune the card hover lift/shadow**

Find:

```tsx
      onMouseEnter={(e) => {
        if (d.ghost) return;
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(-4px)";
        el.style.boxShadow = `0 10px 40px ${d.glow}, 0 2px 10px rgba(0,0,0,0.6)`;
        el.style.borderColor = `${d.c1}66`;
      }}
```

Replace with:

```tsx
      onMouseEnter={(e) => {
        if (d.ghost) return;
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(-5px)";
        el.style.boxShadow = `0 14px 44px ${d.glow}, 0 2px 10px rgba(0,0,0,0.6)`;
        el.style.borderColor = `${d.c1}66`;
      }}
```

- [ ] **Step 3: Retune ghost card opacity**

Find the line (inside the card's outer `style={{...}}` object):

```tsx
        opacity: d.ghost ? 0.55 : 1,
```

Replace with:

```tsx
        opacity: d.ghost ? 0.5 : 1,
```

- [ ] **Step 4: Retune the wash-glow size**

Find:

```tsx
      {!d.ghost && (
        <div style={{
          position: "absolute", top: -40, right: -40, width: 160, height: 160,
          background: `radial-gradient(circle, ${d.glow} 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
      )}
```

Replace with:

```tsx
      {!d.ghost && (
        <div style={{
          position: "absolute", top: -44, right: -44, width: 170, height: 170,
          background: `radial-gradient(circle, ${d.glow} 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
      )}
```

- [ ] **Step 5: Retune the feature-name typography**

Find:

```tsx
      <div style={{
        fontSize: 26, fontWeight: 900, letterSpacing: "-0.5px", marginBottom: 6,
        fontFamily: "var(--font-display, sans-serif)",
        color: d.ghost ? "var(--muted)" : "var(--text)",
      }}>
        {d.feature}
      </div>
```

Replace with:

```tsx
      <div style={{
        fontSize: 25, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6,
        fontFamily: "var(--font-display, sans-serif)",
        color: d.ghost ? "var(--muted)" : "var(--text)",
      }}>
        {d.feature}
      </div>
```

- [ ] **Step 6: Add pip dots to the footer count**

Find:

```tsx
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
```

Replace with:

```tsx
      {/* footer: count + enter */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: 12, borderTop: "1px solid var(--border)",
      }}>
        <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", display: "inline-flex", alignItems: "center", gap: 6 }}>
          {!d.ghost && d.count != null && (
            <span style={{ display: "inline-flex", gap: 3 }}>
              {Array.from({ length: d.count }).map((_, i) => (
                <i key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: d.c1, opacity: 0.9, display: "inline-block" }} />
              ))}
            </span>
          )}
          {d.ghost
            ? (th ? "วางแผนไว้" : "planned")
            : d.count != null
              ? (th ? `${d.count} ตัว` : `${d.count} ${d.count === 1 ? "pick" : "picks"}`)
              : "—"}
        </span>
```

- [ ] **Step 7: Verify it builds**

Run: `cd web && npm run build`
Expected: build succeeds with no new type/lint errors.

- [ ] **Step 8: Manual check**

In the dev server, confirm each of the 3 real element cards (DCA/Catalyst/Turbo) shows a
row of small colored dots matching its pick count before the "N picks" text, in the
element's own accent color, and that the ghost Earth card shows no dots. Hover a card and
confirm the lift/shadow/border-color change fires.

- [ ] **Step 9: Commit**

```bash
git add web/app/Landing.tsx
git commit -m "style: retune element card spacing, add pip-dot pick counters"
```

---

## Task 3: Tools row hover feedback

**Files:**
- Modify: `web/app/Landing.tsx` (Backtest/Journal links + new trailing `<style>` block)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Add hover-capable classNames and a trailing `<style>` block**

Find (the tools row through the end of the component):

```tsx
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
```

Replace with:

```tsx
      {/* ── Secondary tools ──────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", letterSpacing: "1px", textTransform: "uppercase" }}>
          {th ? "เครื่องมือ" : "Tools"}
        </span>
        <Link href="/backtest" className="srw-tbtn" style={{
          fontSize: 12, textDecoration: "none", padding: "7px 14px", borderRadius: 9,
          background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)",
          fontFamily: "var(--font-mono, monospace)", fontWeight: 700,
          display: "inline-block", transition: "border-color 0.16s, color 0.16s, transform 0.16s",
        }}>
          📊 Backtest
        </Link>
        <Link href="/journal" className="srw-tbtn srw-tbtn-journal" style={{
          fontSize: 12, textDecoration: "none", padding: "7px 14px", borderRadius: 9,
          background: "var(--card)", border: "1px solid var(--border)", color: "#f59e0b",
          fontFamily: "var(--font-mono, monospace)", fontWeight: 700,
          display: "inline-block", transition: "border-color 0.16s, color 0.16s, transform 0.16s",
        }}>
          📒 Journal
        </Link>
      </div>

      <style>{`
        .srw-tbtn:hover { border-color: var(--border-bright); color: var(--text); transform: translateY(-1px); }
        .srw-tbtn.srw-tbtn-journal:hover { color: #fbbf24; }
      `}</style>

    </div>
  );
}
```

Note: the mockup's `.tbtn:hover` sets a single generic hover color (`var(--text)`) for
all tool pills. Journal's normal-state color is a distinct amber (`#f59e0b`) carrying
brand meaning (same as the header's Journal link, Phase 1) — turning it generic gray on
hover would read as a regression, so this follows the same convention Phase 1 already
established for the header's `.srw-tool-journal:hover` (brighten to `#fbbf24` instead of
falling back to the generic text color). Backtest has no such distinct color and follows
the mockup exactly.

- [ ] **Step 2: Verify it builds**

Run: `cd web && npm run build`
Expected: build succeeds with no new type/lint errors.

- [ ] **Step 3: Manual check**

In the dev server, hover the Backtest and Journal pills at the bottom of the landing page
and confirm both show a visible border/lift change, and Journal brightens to a lighter
amber rather than turning gray.

- [ ] **Step 4: Commit**

```bash
git add web/app/Landing.tsx
git commit -m "style: add hover feedback to landing tools row"
```

---

## Task 4: Full manual QA pass

**Files:** none modified — verification only.

- [ ] **Step 1: Start the dev server**

Run: `cd web && npm run dev`

- [ ] **Step 2: Walk the design spec's Testing checklist**

Confirm on `/`: no rings/sweep animation behind the hero, ambient glow visible instead,
badge doesn't wrap, EN and TH subhead copy both say "playbook" not "radar", grid card
minmax/hover/opacity/wash/typography values match Task 2, pip dots appear per element
with correct counts and colors, ghost Earth card unaffected, tools row hover works for
both pills.

- [ ] **Step 3: Stop the dev server**

Kill the `npm run dev` process once verification is complete.

- [ ] **Step 4: Mark Phase 2 complete**

No commit needed for this task. Proceed to Phase 3 (Dashboard tab switcher + card
restyles).
