# Landing Page Restyle (Phase 2 of design_handoff_stock_playbook)

## Context

Phase 2 of 4 in implementing `design_handoff_stock_playbook/`. Covers `web/app/Landing.tsx`
only (the element-picker home page body; the shared Header/Ticker from Phase 1 is done and
out of scope here). Source of truth: `design_handoff_stock_playbook/README.md` section "1.
Landing" and `Landing Restyled.dc.html`'s `.hero`/`.egrid`/`.tools` CSS + markup.

User directive for this session: implement Phases 2, 3, and 4 back-to-back without pausing
for per-phase approval — proceed on reasonable judgment calls, document them here, only
stop for a genuine blocker.

## Current state vs. target (the actual delta)

`web/app/Landing.tsx` is **not a blank slate** — a prior pass already implemented large
parts of this correctly. The real work is narrower than "build the mockup":

1. **Hero centerpiece must be removed.** Current hero (`Landing.tsx:303-324`) renders a
   520×520px decorative block of 3 concentric rings + a rotating `conic-gradient` sweep
   ("Radar rings + rotating sweep — behind the mark"). The README is explicit this was
   **removed per feedback**: "Pure ambient depth — no radar rings, sweep animation, or
   radar iconography here; that was removed per feedback." Replace with the mockup's
   `.hglow`: a single absolutely-positioned 900×520px div, `top:-8%`, centered, `z-index:-1`,
   three overlapping `radial-gradient` ellipses (green `rgba(16,185,129,.10)` at 30%/40%,
   blue `rgba(56,189,248,.08)` at 70%/55%, amber `rgba(251,146,60,.07)` at 50%/70%), no
   animation.
   - `RadarMark` (`Landing.tsx:22-63`) is defined but **already dead code** — grepped, it
     is never invoked anywhere in the file. Delete it along with the rings/sweep div;
     nothing else references it.
2. **Badge needs explicit `white-space: nowrap`.** README: "must not wrap to two lines at
   narrow widths." Current badge div (`Landing.tsx:328-341`) has no `whiteSpace` set.
3. **Subhead copy correction.** README explicitly flags this as a previously-wrong draft:
   > "**Do not use the word "radar" in this copy** — earlier drafts said "on one radar";
   > that was corrected."
   Current EN copy (`Landing.tsx:364-365`) still says "...each is a different thesis on
   one radar...". Current TH copy (`Landing.tsx:361-362`) still says "...บนเรดาร์เดียวกัน"
   (on the same radar). Both must change to the spec's exact final copy:
   - EN: "Pick your **investment element** — each is a different thesis in one playbook ·
     institutional-grade analysis"
   - TH: "เลือก**ธาตุการลงทุน**ของคุณ — แต่ละธาตุคือ thesis คนละแบบในเพลย์บุ๊กเดียวกัน ·
     institutional-grade analysis"
4. **Element cards: missing "pip" dots.** The mockup's card footer shows small colored
   dots (one per pick, `5×5px` circle, `border-radius:50%`, `background:var(--c1)`,
   `opacity:.9`, `gap:3px`) immediately before the pick-count text, for the 3 real
   elements (not the ghost Earth card, which has no pips). Current `ElementCard`
   (`Landing.tsx:222-232`) renders only the text count, no pips. Add them.
5. **Value tuning** (structure already correct, only numbers differ from the mockup's
   CSS):
   - Grid: `Landing.tsx:374` `minmax(230px, 1fr)` → mockup's `minmax(232px,1fr)`.
   - Card hover (`Landing.tsx:150-156`, JS `onMouseEnter` handler — this file uses JS
     mouse handlers instead of CSS `:hover`, which is an equally valid existing pattern
     in this file and is **kept**, not converted to CSS): `translateY(-4px)` →
     mockup's `translateY(-5px)`; shadow `0 10px 40px` → mockup's `0 14px 44px`.
   - Ghost card opacity (`Landing.tsx:146`): `0.55` → mockup's `.5`.
   - Wash glow (`Landing.tsx:169-173`): `top:-40,right:-40,width:160,height:160` →
     mockup's `top:-44px,right:-44px,width:170px,height:170px`.
   - Feature name (`Landing.tsx:192-198`): `fontSize:26,fontWeight:900` → mockup's
     `font-size:25px;font-weight:800`.
6. **Tools row needs real hover feedback.** Current Backtest/Journal links
   (`Landing.tsx:387-400`) are plain inline `style={{}}` with no `:hover` — same gap
   Phase 1 fixed on the header's Backtest/Journal links. Mockup: `.tbtn:hover{border-color:
   var(--border2);color:var(--text);transform:translateY(-1px)}`. `Landing.tsx` currently
   has no trailing `<style>` tag at all — add one, following the exact pattern
   `Header.tsx` already established in Phase 1 (className + scoped `<style>` block for
   hover rules).

## Explicitly NOT changed (already correct, or out of scope)

- `<h1>Stock Playbook</h1>` (`Landing.tsx:344-352`): gradient
  (`linear-gradient(96deg,#7dd3fc,#34d399 42%,#fb923c 74%,#e879f9)`), size
  (`clamp(34px,6.5vw,58px)`), letter-spacing (`-1.6px`) — already byte-identical to spec.
  No change.
- All three `ElementAmbient` treatments (water wave, air wind-streaks, fire flicker,
  `Landing.tsx:65-129`) — already implemented, same animation concepts as the mockup's
  `.amb-water`/`.streak`/`.amb-fire`. Left as-is; not worth risking a working, already-
  matching effect for a pixel-level animation-timing diff that the README doesn't call
  out as a specific complaint.
- No color-swatch legend row exists currently — correctly absent already, matches
  "removed per feedback" in the README. Nothing to do.
- `globals.css:327-335`'s `.radar-rings`/`.radar-hero-icon` pre-staged CSS classes are
  **not used** by this phase — they were staged for the old rings+icon hero treatment
  that this phase removes, i.e. they target a superseded design, not the current one.
  (Project memory corrected to reflect this — see below.)
- `ElementDef`/`ElementCard`/`ElementAmbient` component structure, routing (`/dca`,
  `/catalyst`, `/turbo`), ghost Earth card — unchanged.

## Non-goals

- No changes to `web/app/Header.tsx`, `MarketTicker.tsx`, `layout.tsx` (Phase 1, done).
- No changes to dashboard pages or `LoginGate.tsx` (Phases 3-4).
- No new npm dependencies.

## Testing

Same constraints as Phase 1: no automated test suite for this file. Verification =
`npm run build` per task + a runtime check (curl against a live dev server, since this
file also uses inline styles that render literally into HTML — same method that worked
well in Phase 1) for the non-interactive parts (hero markup, pip dots, copy text), plus
a code-level confirmation for the JS-driven hover (`onMouseEnter`/`onMouseLeave`) and
CSS-driven tools-row hover, which curl cannot exercise.
