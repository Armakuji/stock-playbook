# Header + Ticker Restyle (Phase 1 of design_handoff_stock_playbook)

## Context

`design_handoff_stock_playbook/` contains a high-fidelity design handoff (3 `.dc.html`
prototypes + README) rebranding/restyling the Stock Playbook app. The work spans four
independent pieces: shared Header/Ticker, Landing page, Dashboard (tab switcher + cards),
and the Journal login gate. This spec covers **Phase 1 only: the shared Header and
MarketTicker components**, since Landing, Dashboard, and Journal all render inside the
header/ticker and should build on the finished version of this piece.

Source of truth for visual detail: `design_handoff_stock_playbook/README.md` (section
"Shared Header + Ticker") and the identical `<header class="hdr">` / `.tick` markup+CSS
duplicated across all three `.dc.html` files.

## Current state

- `web/app/Header.tsx` — client component, already has: radar logo/wordmark, DCA/Catalyst/
  Turbo gradient nav pills, Backtest/Journal text links, live-dot + "Updated", EN/TH
  `LangToggle`, `AuthWidget` (Google-photo avatar w/ dropdown, or Login button), and a
  full mobile hamburger drawer. Copy already says "Stock Playbook" (rebrand text is done).
- `web/app/MarketTicker.tsx` — client component, already has: verdict pill dynamically
  colored by live BUY/SELECTIVE/WAIT verdict, auto-scrolling crawl, dynamic entry-window
  pill (green "ENTRY NOW" vs blue "Entry {label}"), chevron-toggled drawer containing
  summary + entry callout + Event Risk Calendar table + IF/THEN decision tree + Macro
  Snapshot grid.
- `web/app/layout.tsx:128-134` — **the top accent bar already exists** and already matches
  the spec exactly: same 5-stop gradient, `backgroundSize: "300% 100%"`, `gradientShift`
  keyframe (defined in `globals.css:44-47`) animating over 8s linear infinite. It renders
  as a sibling before `<Header>`, not inside it, matching the prototype's
  `<div class="accentbar"></div><header class="hdr">` structure. **No change needed here.**
- `web/app/globals.css:299-359` — a pre-staged "Stock Playbook — restyle additions" block
  (theme tokens, `.radar-card`, `.radar-ring`, `.radar-pills`/`.radar-pill`, `.radar-title`,
  `.radar-rings`/`.radar-hero-icon`) already exists but is **not yet consumed by any
  component**. This is scaffolding for Phase 2 (Landing) and Phase 3 (Dashboard), not
  Phase 1 — noted here for continuity, no action in this phase.

So this phase is a **visual retune of working components**, not a rebuild.

## Decisions (confirmed with user)

1. **Ticker drawer content**: keep all existing sections (calendar, decision tree, macro
   snapshot) — restyle only, do not cut down to the prototype's simplified summary+entry
   view. The prototype's simpler drawer is a demo artifact, not an intentional scope cut.
2. **Ticker/entry coloring**: keep dynamic behavior (bar/pill color follows live verdict;
   entry pill flips green/blue based on whether an entry window is currently active) —
   do not hardcode the prototype's static amber/blue demo colors.
3. **Mobile nav**: keep the existing hamburger-drawer mechanism for reaching DCA/Catalyst/
   Turbo/Backtest/Journal on narrow screens. The prototype has no alternative mobile nav
   pattern and the app needs a way to navigate cross-section from e.g. `/journal` on
   mobile. Only restyle the drawer's colors/spacing and shift the desktop/mobile
   breakpoint from 720px to 760px to match the spec.
4. **Radar logo/favicon**: unchanged (explicit in handoff — "kept as-is, this is the
   app's icon/logo and should NOT be changed").

## Changes

### `web/app/Header.tsx`

1. **Header container**: change from static `backgroundColor: var(--card)` to
   `position: sticky; top: 0; z-index: 30; background: rgba(12,12,20,.72); backdrop-filter: blur(12px)`
   (add `-webkit-backdrop-filter` too for Safari). Keep existing `borderBottom`.
2. **Nav pill group**: `border-radius: 11px`, `padding: 4px`, background `#0a0a12`
   (currently `var(--card)`/radius 10/padding 3). Add a hover rule via the existing
   `<style>` block: `.srw-pill:hover { background: rgba(255,255,255,.04) !important }` —
   requires giving each pill link a `className="srw-pill"` alongside its inline style
   (inline styles can't express `:hover`).
3. **Tool links** (`Backtest`, `Journal`): add hover brighten (`color` transitions to
   `var(--text)` on hover, Journal link stays amber but brightens) via a shared
   `.srw-tool:hover` CSS rule.
4. **Avatar**: resize 32→30px; when falling back to initials (no photo / image error),
   background becomes `linear-gradient(135deg,#3b82f6,#8b5cf6)` instead of solid `#3b82f6`.
   The photo-avatar path (`<img>`) is unchanged — the prototype only models the
   initials case, but showing the user's real Google photo when available is strictly
   better UX and stays.
5. **Login button**: `padding: 7px 16px`, `border-radius: 9px` (currently `5px 12px`/`7px`).
   Add hover lift (`translateY(-1px)` + shadow) consistent with other interactive
   elements' hover treatment.
6. **Breakpoint**: `720px` → `760px` in the existing `.srw-desktop`/`.srw-burger` media
   query. Mobile drawer keeps its current structure/content; only recolor to match new
   tokens (`#0a0a12` surfaces, updated border colors) where it visibly diverges.
7. **LangToggle**: no functional change; already matches spec tokens exactly (`#3b82f6`
   active pill).

### `web/app/MarketTicker.tsx`

1. Retune `VERDICT_STYLE` background opacity / border tokens to match the spec's exact
   amber reference values (`rgba(245,158,11,.07)` bg / `rgba(245,158,11,.22)` border for
   the amber case) — apply the equivalent proportional adjustment to the green/red cases
   so all three stay visually consistent with each other. Verdict pill itself keeps
   `background: rgba({color},.12)`/`border: 1px solid rgba({color},.4)` per spec.
2. Entry pill: retune padding (`3px 9px`, `radius 5px`) and blue token (`var(--water)
   #38bdf8`) to match spec; keep the existing green/blue conditional logic.
3. Crawl track: no structural change — already has edge-mask fade, pause-on-hover,
   measured-width duration. Just confirm font-size (`11.5px` per spec vs current `11px`)
   and separator color (`var(--border2)` / `#26264a`) match.
4. Drawer: restyle container background/border to spec's `var(--card)` +
   `rgba(245,158,11,.18)` border-bottom, retune the "BEST ENTRY WINDOW" callout box
   padding/radius to spec (`9px 16px`, `radius 9px`). Calendar table, decision tree, and
   macro snapshot grid keep their current layout/content — only token-level color/spacing
   touch-ups where they visibly clash with the new palette (e.g. card surfaces should use
   `var(--card)`/`rgba(0,0,0,.15)` panels consistently with the rest of the new look).
5. Chevron: no change (already rotates 180°, already `transition: transform .2s ease`).

## Non-goals for this phase

- No changes to `Landing.tsx`, dashboard pages, or `LoginGate.tsx` (later phases).
- No changes to the radar logo/favicon SVGs.
- No changes to `MarketTimingData` shape, `LanguageContext`, or `auth-client.ts`.
- No new npm dependencies — plain inline styles + a `<style>` tag, matching existing
  component patterns.

## Testing

- Manual: run dev server, verify header sticks + blurs on scroll (accent bar above it
  already works, unaffected by this phase), ticker bar recolors correctly for each verdict
  value (spot-check by temporarily editing local `market-timing.json` fixture if available,
  or reasoning from code), drawer expands/collapses, mobile hamburger still opens/closes
  and links work at <760px, hover states fire on pills/links/buttons/avatar/login button,
  `prefers-reduced-motion` freezes the spark animation.
- No automated test suite currently covers these components (visual/presentational); no
  new tests planned for this phase beyond manual verification via the `run`/`verify`
  workflow already used in this project.
