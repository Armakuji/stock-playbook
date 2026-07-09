# Header + Ticker Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retune `web/app/Header.tsx` and `web/app/MarketTicker.tsx` to match the
`design_handoff_stock_playbook` visual spec (sticky/glass header, retuned pill/avatar/
button tokens, retuned ticker verdict/entry colors and drawer chrome) while preserving
all existing dynamic behavior (live verdict coloring, entry-window state, full drawer
content, mobile hamburger nav).

**Architecture:** Both files are existing client components with inline-style React and
a single trailing `<style>` tag for keyframes/media-queries/hover rules (no CSS modules,
no Tailwind classes in these two files). This plan edits them in place — no new files,
no new components, no dependency changes.

**Tech Stack:** Next.js 15 App Router, React (client components), plain inline styles +
scoped `<style>` tags, existing `useLang()` / `LanguageContext`, existing
`fetchCurrentUser()` / `auth-client.ts` (untouched).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-09-header-ticker-restyle-design.md` — every
  task below implements one numbered item from that spec's "Changes" section.
- Do NOT touch `web/app/layout.tsx` — the top accent bar there is already correct.
- Do NOT touch the radar logo/favicon SVGs (`RadarBadge` in `Header.tsx`, `icon.svg`).
- Do NOT change `MarketTimingData`/`Week`/`DecisionItem` types or drop any drawer section
  (calendar, decision tree, macro snapshot) — restyle only.
- Keep dynamic verdict-based and entry-window-based coloring (no hardcoded static colors
  from the prototype's single-state demo).
- No new npm dependencies.
- No automated test suite exists for these two files (presentational, no test framework
  configured beyond `eslint`/`next build`). Verification per task = `npm run build`
  (type-checks + lints via Next's build pipeline) + manual browser check. A final task
  does a full manual QA pass against the design spec's Testing section.

---

## Task 1: Sticky/glass header container + nav pill hover

**Files:**
- Modify: `web/app/Header.tsx:247-268` (header element + nav pill rendering)
- Modify: `web/app/Header.tsx:364-401` (trailing `<style>` block)

**Interfaces:**
- Consumes: nothing new.
- Produces: `.srw-pill` className now available on desktop nav `<Link>` elements for any
  later task/component that wants the same hover treatment.

- [ ] **Step 1: Change the header container to sticky + glass**

In `web/app/Header.tsx`, find:

```tsx
    <header style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)", position: "relative" }}>
```

Replace with:

```tsx
    <header style={{
      borderBottom: "1px solid var(--border)",
      background: "rgba(12,12,20,0.72)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      position: "sticky",
      top: 0,
      zIndex: 30,
    }}>
```

- [ ] **Step 2: Restyle the nav pill group container**

Find:

```tsx
          <nav style={{
            display: "flex", alignItems: "center", gap: 2,
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 3,
          }}>
```

Replace with:

```tsx
          <nav style={{
            display: "flex", alignItems: "center", gap: 2,
            background: "#0a0a12", border: "1px solid var(--border)",
            borderRadius: 11, padding: 4,
          }}>
```

- [ ] **Step 3: Add a hover className to the desktop nav pills only**

Find (inside the desktop nav `<nav>` block, the `STRATEGY.map` that renders the pills):

```tsx
            {STRATEGY.map((s) => (
              <Link key={s.href} href={s.href} title={th ? s.titleTh : s.titleEn} style={{ ...gradLink, backgroundImage: s.grad }}>
                {s.label}
              </Link>
            ))}
          </nav>
          <Link href="/backtest" title="Backtest" style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none", fontFamily: "var(--font-mono, monospace)", fontWeight: 700, letterSpacing: "0.3px" }}>
            📊 Backtest
          </Link>
          <Link
            href="/journal"
            title={th ? "Journal — AI ตรวจแผนเทรด" : "Journal — AI plan validation"}
            style={{
              fontSize: 11, color: "#f59e0b", textDecoration: "none",
              fontFamily: "var(--font-mono, monospace)", fontWeight: 700, letterSpacing: "0.3px",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            📒 Journal <span className="srw-ai-spark" aria-hidden>✦</span>
          </Link>
```

Replace with (adds `className="srw-pill"` to the 3 strategy pills, `className="srw-tool"`
to Backtest, `className="srw-tool srw-tool-journal"` to Journal):

```tsx
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
```

- [ ] **Step 4: Add the hover CSS rules**

In the trailing `<style>` block, find:

```tsx
      <style>{`
        .srw-desktop { display: flex; }
        .srw-burger  { display: none; }
        @media (max-width: 720px) {
          .srw-desktop { display: none; }
          .srw-burger  { display: flex; }
          .srw-logo    { font-size: 16px; }
        }
```

Replace with:

```tsx
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
```

(Note: the `@media (max-width: 720px)` → `760px` change here also completes Task 4's
breakpoint requirement — both live in the same block, done together to avoid two passes
over the same lines.)

- [ ] **Step 5: Verify it builds**

Run: `cd web && npm run build`
Expected: build succeeds with no new type or lint errors.

- [ ] **Step 6: Manual check**

Run `npm run dev` in `web/`, open the site, confirm: header is pinned to the top when you
scroll down and shows a translucent blurred background over content scrolling beneath it;
hovering the DCA/Catalyst/Turbo pills, Backtest, and Journal links shows a visible hover
state; nothing shifted position unexpectedly.

- [ ] **Step 7: Commit**

```bash
git add web/app/Header.tsx
git commit -m "style: sticky/glass header + nav pill hover states"
```

---

## Task 2: Avatar, login button, and mobile breakpoint polish

**Files:**
- Modify: `web/app/Header.tsx` (Avatar component, AuthWidget login link, mobile
  MobileProfileSection login link, AVATAR_SIZE constant, `.srw-burger` background)

**Interfaces:**
- Consumes: `.srw-tool`/`.srw-pill` CSS added in Task 1 (no direct dependency, just same
  file).
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Resize the avatar and gradient the initials fallback**

Find:

```tsx
const AVATAR_SIZE = 32;

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
      width: size, height: size, borderRadius: "50%", display: "flex", background: "#3b82f6", color: "#fff",
      alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.4), fontWeight: 800, flexShrink: 0,
    }}>
      {initials(user)}
    </span>
  );
}
```

Replace with:

```tsx
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
```

- [ ] **Step 2: Restyle the desktop login button + add hover lift**

Find (inside `AuthWidget`):

```tsx
      <a
        href={loginUrl(pathname)}
        style={{
          fontSize: 11, fontWeight: 800, padding: "5px 12px", borderRadius: 7,
          background: "#10b981", color: "#fff", textDecoration: "none",
          fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.3px", whiteSpace: "nowrap",
        }}
      >
        {th ? "เข้าสู่ระบบ" : "Login"}
      </a>
```

Replace with:

```tsx
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
```

- [ ] **Step 3: Add the login-button hover rule and burger surface color**

In the trailing `<style>` block (same one edited in Task 1), find:

```tsx
        .srw-pill:hover { background: rgba(255,255,255,0.04) !important; }
        .srw-tool { transition: color 0.15s; }
        .srw-tool:hover { color: var(--text) !important; }
        .srw-tool-journal:hover { color: #fbbf24 !important; }
```

Replace with:

```tsx
        .srw-pill:hover { background: rgba(255,255,255,0.04) !important; }
        .srw-tool { transition: color 0.15s; }
        .srw-tool:hover { color: var(--text) !important; }
        .srw-tool-journal:hover { color: #fbbf24 !important; }
        .srw-loginbtn:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(16,185,129,0.35); }
```

- [ ] **Step 4: Recolor the mobile hamburger button surface**

Find:

```tsx
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
```

Replace with:

```tsx
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
```

- [ ] **Step 5: Verify it builds**

Run: `cd web && npm run build`
Expected: build succeeds with no new type or lint errors.

- [ ] **Step 6: Manual check**

In the dev server, log out and confirm the "Login" button shows the new padding/radius
and lifts on hover; log in (or inspect via a test account if available) and confirm the
avatar renders at 30px, and the gradient fallback shows correctly when there's no photo
(e.g. temporarily force `showImg = false` locally to eyeball it, then revert — do not
commit a debug change). Shrink the viewport below 760px and confirm the hamburger button's
surface color changed and the menu still opens/closes and every link still navigates.

- [ ] **Step 7: Commit**

```bash
git add web/app/Header.tsx
git commit -m "style: retune avatar/login button tokens, mobile burger surface"
```

---

## Task 3: MarketTicker verdict/pill/entry color retune

**Files:**
- Modify: `web/app/MarketTicker.tsx:66-76` (`VERDICT_STYLE` map)
- Modify: `web/app/MarketTicker.tsx:141-194` (bar/pill/entry/crawl render)
- Modify: `web/app/MarketTicker.tsx:196-198` (drawer border)

**Interfaces:**
- Consumes: nothing new.
- Produces: `VERDICT_STYLE` shape changes from `{ color, bg, border, emoji }` to
  `{ color, emoji, barBg, barBorder, pillBg, pillBorder, drawerBorder }` — every usage of
  `vs.bg`/`vs.border` in this file must be updated in the same task (all usages are in
  this file, no external consumers of `VERDICT_STYLE`).

- [ ] **Step 1: Replace the `VERDICT_STYLE` map**

Find:

```tsx
const VERDICT_STYLE: Record<MarketTimingData["verdict"], { color: string; bg: string; border: string; emoji: string }> = {
  BUY:       { color: "#10b981", bg: "rgba(16,185,129,0.10)",  border: "#10b981", emoji: "🟢" },
  SELECTIVE: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "#f59e0b", emoji: "🟡" },
  WAIT:      { color: "#ef4444", bg: "rgba(239,68,68,0.10)",   border: "#ef4444", emoji: "🔴" },
};
```

Replace with:

```tsx
const VERDICT_STYLE: Record<MarketTimingData["verdict"], {
  color: string; emoji: string;
  barBg: string; barBorder: string;
  pillBg: string; pillBorder: string;
  drawerBorder: string;
}> = {
  BUY: {
    color: "#10b981", emoji: "🟢",
    barBg: "rgba(16,185,129,0.07)", barBorder: "rgba(16,185,129,0.22)",
    pillBg: "rgba(16,185,129,0.12)", pillBorder: "rgba(16,185,129,0.4)",
    drawerBorder: "rgba(16,185,129,0.18)",
  },
  SELECTIVE: {
    color: "#f59e0b", emoji: "🟡",
    barBg: "rgba(245,158,11,0.07)", barBorder: "rgba(245,158,11,0.22)",
    pillBg: "rgba(245,158,11,0.12)", pillBorder: "rgba(245,158,11,0.4)",
    drawerBorder: "rgba(245,158,11,0.18)",
  },
  WAIT: {
    color: "#ef4444", emoji: "🔴",
    barBg: "rgba(239,68,68,0.07)", barBorder: "rgba(239,68,68,0.22)",
    pillBg: "rgba(239,68,68,0.12)", pillBorder: "rgba(239,68,68,0.4)",
    drawerBorder: "rgba(239,68,68,0.18)",
  },
};
```

- [ ] **Step 2: Update the ticker bar background/border**

Find:

```tsx
        style={{
          display: "flex", alignItems: "center", width: "100%",
          background: vs.bg, borderBottom: `1px solid ${vs.border}35`,
          border: "none", borderBottomWidth: 1, cursor: "pointer", textAlign: "left", padding: 0,
        }}
```

Replace with:

```tsx
        style={{
          display: "flex", alignItems: "center", width: "100%",
          background: vs.barBg, borderBottom: `1px solid ${vs.barBorder}`,
          border: "none", borderBottomWidth: 1, cursor: "pointer", textAlign: "left", padding: 0,
        }}
```

- [ ] **Step 3: Update the verdict pill background/border**

Find:

```tsx
          <span style={{
            fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 6,
            background: vs.bg, color: vs.color, border: `1px solid ${vs.border}50`,
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
            {vs.emoji} {verdictLabelText.toUpperCase()}
          </span>
```

Replace with:

```tsx
          <span style={{
            fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 6,
            background: vs.pillBg, color: vs.color, border: `1px solid ${vs.pillBorder}`,
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
            {vs.emoji} {verdictLabelText.toUpperCase()}
          </span>
```

- [ ] **Step 4: Retune the crawl font size and separator color**

Find:

```tsx
            <div ref={crawlRef} className={`srw-ticker-crawl${open ? " is-open" : ""}`} style={{
              display: "inline-flex", whiteSpace: "nowrap", fontSize: 11,
              animationDuration: `${duration}s`,
            }}>
```

Replace with:

```tsx
            <div ref={crawlRef} className={`srw-ticker-crawl${open ? " is-open" : ""}`} style={{
              display: "inline-flex", whiteSpace: "nowrap", fontSize: 11.5,
              animationDuration: `${duration}s`,
            }}>
```

Then find both occurrences of the separator span (one inside the `Crawl` component
definition, one between the two `<Crawl />` calls):

```tsx
          {i > 0 && <span style={{ color: "var(--border)", margin: "0 14px" }}>•</span>}
```

and

```tsx
              <Crawl /><span style={{ color: "var(--border)", margin: "0 14px" }}>•</span><Crawl />
```

Replace `var(--border)` with `var(--border-bright)` in both (keep everything else
identical):

```tsx
          {i > 0 && <span style={{ color: "var(--border-bright)", margin: "0 14px" }}>•</span>}
```

```tsx
              <Crawl /><span style={{ color: "var(--border-bright)", margin: "0 14px" }}>•</span><Crawl />
```

- [ ] **Step 5: Retune the entry pill padding/radius/border**

Find:

```tsx
          <span className="srw-ticker-entry" style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
            background: inEntryWindow ? "rgba(16,185,129,0.15)" : "rgba(56,189,248,0.10)",
            color: inEntryWindow ? "#10b981" : "#38bdf8",
            border: `1px solid ${inEntryWindow ? "rgba(16,185,129,0.35)" : "rgba(56,189,248,0.25)"}`,
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
```

Replace with:

```tsx
          <span className="srw-ticker-entry" style={{
            fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5,
            background: inEntryWindow ? "rgba(16,185,129,0.15)" : "rgba(56,189,248,0.10)",
            color: inEntryWindow ? "#10b981" : "#38bdf8",
            border: `1px solid ${inEntryWindow ? "rgba(16,185,129,0.35)" : "rgba(56,189,248,0.28)"}`,
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
```

- [ ] **Step 6: Update the drawer border to use `drawerBorder`**

Find:

```tsx
        <div style={{ borderBottom: `1px solid ${vs.border}20`, background: "var(--card)" }}>
```

Replace with:

```tsx
        <div style={{ borderBottom: `1px solid ${vs.drawerBorder}`, background: "var(--card)" }}>
```

- [ ] **Step 7: Verify it builds**

Run: `cd web && npm run build`
Expected: build succeeds with no type errors (confirms every `vs.bg`/`vs.border` usage
was migrated — a leftover reference to the old fields would fail TypeScript compilation
since they no longer exist on the type).

- [ ] **Step 8: Manual check**

In the dev server, confirm the ticker bar renders with the new subtler background and the
verdict pill has a distinctly stronger background than the bar behind it (the visual
hierarchy the spec calls for: pill pops, bar stays understated). Click the entry pill's
active/inactive states if you can toggle a local `market-timing.json` fixture's
`entryWindow.start`/`end` — if not practical, confirm via code review that both branches
compile and use the retuned padding.

- [ ] **Step 9: Commit**

```bash
git add web/app/MarketTicker.tsx
git commit -m "style: retune ticker verdict/pill/entry colors to new palette"
```

---

## Task 4: Drawer entry-callout box polish

**Files:**
- Modify: `web/app/MarketTicker.tsx:206-225` (entry-window callout box inside the drawer)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Retune the callout box padding/radius**

Find:

```tsx
              <div style={{
                alignSelf: "center",
                width: "100%",
                maxWidth: 360,
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.25)",
                textAlign: "center",
              }}>
```

Replace with:

```tsx
              <div style={{
                alignSelf: "center",
                width: "100%",
                maxWidth: 360,
                padding: "9px 16px",
                borderRadius: 9,
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.25)",
                textAlign: "center",
              }}>
```

- [ ] **Step 2: Verify it builds**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual check**

Expand the ticker drawer in the dev server and confirm the "BEST ENTRY WINDOW" callout box
still renders correctly (centered, readable, no overflow) with the new padding/radius, and
that the Event Risk Calendar table, IF/THEN decision tree, and Macro Snapshot grid below
it are all still present and unchanged (this task must not have touched them).

- [ ] **Step 4: Commit**

```bash
git add web/app/MarketTicker.tsx
git commit -m "style: retune ticker drawer entry-callout box spacing"
```

---

## Task 5: Full manual QA pass against the design spec

**Files:** none modified — verification only.

**Interfaces:**
- Consumes: the complete Header.tsx/MarketTicker.tsx from Tasks 1-4.
- Produces: go/no-go signal for closing out Phase 1.

- [ ] **Step 1: Start the dev server**

Run: `cd web && npm run dev`

- [ ] **Step 2: Walk the design spec's Testing checklist**

Open the site in a browser and confirm each item from
`docs/superpowers/specs/2026-07-09-header-ticker-restyle-design.md`'s Testing section:
- Header sticks to the top and shows the blurred/translucent background when scrolling a
  page with enough content to scroll (e.g. `/dca` or `/catalyst`).
- Ticker bar/pill colors correctly reflect whatever verdict is currently in
  `web/data/market-timing.json` (BUY=green, SELECTIVE=amber, WAIT=red).
- Ticker drawer expands/collapses on click, chevron rotates, and all four sections
  (summary, entry callout, calendar table, decision tree + macro snapshot) render.
- On a narrow viewport (<760px), the hamburger opens, all links work, and the desktop nav
  is hidden.
- Hover states fire on: nav pills, Backtest link, Journal link, login button, avatar
  button (cursor pointer + no layout shift).
- With OS-level "reduce motion" enabled (or via devtools' `prefers-reduced-motion`
  emulation), the Journal spark animation freezes.

- [ ] **Step 3: Stop the dev server**

Kill the `npm run dev` process once verification is complete — do not leave it running.

- [ ] **Step 4: Mark Phase 1 complete**

No commit needed for this task (verification only). Report results back before starting
Phase 2 (Landing page restyle).
