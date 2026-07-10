# Dashboard Tab Switcher + Card Restyles (Phase 3 of design_handoff_stock_playbook)

## Context

Phase 3 of 4. Covers `/dca`, `/catalyst`, `/turbo` — three fully independent route trees
(confirmed: no shared layout, no route group; each is `page.tsx` (server) →
`*Content.tsx` (client) → `*Card.tsx`). Source of truth:
`design_handoff_stock_playbook/README.md` section "2. Dashboard" and
`Stock Playbook Dashboard.dc.html`.

User directive for this session: implement Phases 2, 3, 4 back-to-back without pausing
for per-phase approval.

## Current state vs. target (the actual delta)

This is the largest of the 4 phases in raw file count, but much less green-field than it
looks — two of three cards already consume the right CSS classes, and the stats/tier
rows already exist in near-final form. The real gaps:

1. **No cross-route switcher exists at all.** Each of the 3 routes has its own bespoke
   "hero header" (pulsing dot + gradient `<h1>` + subtitle) — this is functionally
   equivalent to the mockup's `.phead`, already close to done. But none of them link to
   each other; DCA's only switcher toggles Funds/Stocks *within* `/dca`, unrelated to the
   mockup's DCA↔Catalyst↔Turbo pill group. This is the one genuinely missing feature.
2. **The CSS for the switcher already exists, unused.** `globals.css:351-358`'s
   `.radar-pills`/`.radar-pill` (+ `.on-water`/`.on-air`/`.on-fire`) is a near-exact match
   to the mockup's `.pills`/`.pill` (+ `.on.w`/`.on.a`/`.on.f`) — same values, different
   class names. Build the new switcher on `radar-pills`/`radar-pill`, don't reinvent it.
3. **Mini-hero (`.dhero`) is missing.** The mockup puts a small LIVE badge + one-line
   tagline ("Pick your investment element below — re-ranked automatically every week.")
   above the switcher, tying dashboard pages back to the Landing page's badge language.
   None of the 3 routes have this today.
4. **Stats row / tier row: value-tuning only**, already structurally present and close:
   - Grid: all 3 use `minmax(110px, 1fr)` → mockup's `minmax(120px, 1fr)`.
   - Value font-size: all 3 use `17px` → mockup's `18px`.
   - Card grid: all 3 use `minmax(280px, 1fr)` → mockup's `minmax(300px, 1fr)`.
   - Catalyst's sort tag says "sorted: catalyst proximity · conviction" — mockup says
     just "sorted: catalyst proximity" (drop the "· conviction" suffix — not a real
     ranking factor exposed anywhere in the UI, just trim to match).
5. **Two of three cards already correctly use the shared CSS.** `DcaCard.tsx` and
   `TurboCard.tsx` already use `radar-card`/`radar-ring`/`radar-ring-in`/`radar-mk`
   (confirmed via grep) — they are NOT green-field. `StockCard.tsx` (Catalyst's card) is
   the outlier: fully independent implementation using `var(--card)`/`var(--border)`
   (global tokens) instead of the per-theme `--surface`/`--brd` tokens the `theme-air`
   wrapper already provides, plus a hand-rolled SVG ring instead of `radar-ring`, plus
   JS `onMouseEnter`/`onMouseLeave` hover instead of CSS.

## Decisions (scoping — no back-and-forth this session per user directive, documented here)

1. **Build the switcher as a new shared component**, `web/app/DashboardSwitcher.tsx`,
   imported into all 3 `*Content.tsx` files. There's no shared layout to hang it on
   (confirmed), so a new small shared component — not a route-group layout rewrite — is
   the minimal-risk way to de-duplicate it across 3 independent route trees.
2. **Switcher needs real cross-category counts** (DCA total, Catalyst total, Turbo
   total), not just the current route's own count. `web/app/page.tsx` already computes
   exactly these three counts today (`getAllDcaReports().length`,
   `getAllReports().length`, `getAllSpeculativeReports().length`) for the Landing page's
   element cards — reuse the same three loader calls in each dashboard `page.tsx`,
   passed down through `*Content.tsx` into `DashboardSwitcher`. Cheap (just reads JSON
   files already being read elsewhere), no new data layer.
3. **DcaCard/TurboCard's fine-grained chip/gauge/bar pixel values are OUT OF SCOPE for
   this phase.** They already use the correct shared CSS classes (`radar-card`/
   `radar-ring`/`radar-mk`) and are visually coherent with the design system; chasing
   every gauge-bar/chip pixel value against the mockup's `.chips`/`.gauge`/`.tchips`/
   `.moon` CSS (which isn't even pre-staged in `globals.css` — it would mean introducing
   ~8 new CSS classes not yet used anywhere) is a large expansion of this phase's scope
   for comparatively low visual delta. **Logging as a follow-up `/todo` item** so it
   isn't silently dropped, not doing it in this pass.
4. **`StockCard.tsx` (Catalyst's card) keeps its richer feature set** — the hand-rolled
   `ScoreRing` SVG, the detailed `PriceBar` (SL→TP3 range + entry/TP1/TP2 markers, richer
   than the mockup's plain fill bar), JS-driven hover, and `ThemeGroups`' grouping-by-
   catalyst-event-type presentation (which the static mockup doesn't model at all — the
   mockup is a flat single-grid demo with no equivalent grouping feature). Rebuilding
   `StockCard` onto `radar-card`/`radar-ring` to match the mockup's simpler card literally
   would be a regression in shipped functionality for a cosmetic-consistency gain.
   **Scoped fix instead:** retune only `StockCard`'s container background/border to use
   the theme surface tokens (`var(--surface)`/`var(--brd)` instead of `var(--card)`/
   `var(--border)`) so it visually sits in the same "surface family" as the DCA/Turbo
   cards on their own theme, without touching its ring/bar/grouping logic.
5. **`ThemeGroups`/`StockCard` are used only by `CatalystContent`** (confirmed via grep
   — no other consumer) — so this scoped retune has zero blast radius elsewhere.

## Explicitly NOT changed / non-goals

- No changes to `Header.tsx`, `MarketTicker.tsx`, `layout.tsx`, `Landing.tsx` (Phases 1-2).
- No new shared layout / route group (`web/app/(dashboard)/layout.tsx`) — the new
  `DashboardSwitcher` component is imported individually into each `*Content.tsx`
  instead, matching the plan's "smaller focused files, minimal risk" principle over a
  broader routing refactor.
- No change to `DcaCard.tsx`/`TurboCard.tsx` internals (see Decision 3) beyond what's
  needed to consume new props, if any (none needed — they don't render the switcher).
- No change to `RankingChangeTable`, `CatalystCalendar`, `FactorRiskPanel` sections.
- No new npm dependencies.

## Files touched

- Create: `web/app/DashboardSwitcher.tsx`
- Modify: `web/app/dca/page.tsx`, `web/app/catalyst/page.tsx`, `web/app/turbo/page.tsx`
  (compute + pass the 3 cross-category counts + `lastUpdated`)
- Modify: `web/app/dca/DcaContent.tsx`, `web/app/catalyst/CatalystContent.tsx`,
  `web/app/turbo/TurboContent.tsx` (accept new props, render `<DashboardSwitcher>`,
  value-tune stats/tier/grid)
- Modify: `web/app/StockCard.tsx` (surface/border token retune only)

## Testing

Same constraints as Phases 1-2: no automated test suite. Verification = `npm run build`
per task + curl against a live dev server for markup/values, plus a code-level check
that the switcher correctly highlights the active tab per route and links to the other
two (curl across the 3 routes can confirm which pill gets `on-*` on each page — a real
runtime check, not just a code read).
