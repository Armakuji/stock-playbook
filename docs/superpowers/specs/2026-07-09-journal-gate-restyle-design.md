# Journal Login Gate Restyle (Phase 4 of design_handoff_stock_playbook)

## Context

Phase 4 of 4 (final phase). Covers `web/app/journal/LoginGate.tsx` only — the logged-out
gate shown at `/journal` before Google auth. Source of truth:
`design_handoff_stock_playbook/README.md` section "3. Journal login gate" and
`Journal.dc.html`'s `.gate`/`.ghero`/`.gcta`/`.gfeats` CSS + markup.

User directive for this session: implement Phases 2, 3, 4 back-to-back without pausing
for per-phase approval.

## Current state vs. target (the actual delta)

Unlike Phases 1-3, this file is NOT close to the mockup — it appears to be an earlier,
partially-polished pass (has hover states and a float animation) that predates several
pieces the README explicitly calls out as "the up-styled one" over "an earlier stiff
version." The gaps are structural, not just value-tuning:

1. **No ambient background at all.** Mockup has `.gglow` (two overlapping radial
   gradients: amber `rgba(245,158,11,.16)` centered, purple `rgba(139,92,246,.13)` offset
   30%/70%, `640×520px`, `top:-10%`, centered, `z-index:-1`) plus `.grings` (two static
   decorative circles, `200px`/`340px`, `opacity:.35`, no animation — "just soft circles
   for depth", explicitly NOT radar rings). Current `LoginGate.tsx` renders neither —
   zero ambient decoration behind the hero.
2. **Icon: too small, no pulsing ring, no rotate.** Current icon is `60×60px`, float-only
   (`lgFloat`: translateY only). Mockup's icon is `84×84px` with a separate
   `.gicon-ring` sibling (pulsing outline ring, `ringPulse` 2.6s scale+fade loop — README:
   "this replaced the static icon in the original stiff version") and the float keyframe
   itself (`gfloat`) also includes a `rotate(-2deg)` at the midpoint, not just vertical
   bob.
3. **AI-powered badge missing `white-space: nowrap`.** README is explicit this is a
   regression fix: "must have `white-space:nowrap` (this wrapped to two lines in an
   earlier pass; keep it fixed)." Current badge has no `whiteSpace` set at all.
4. **`<h1>Trade Journal</h1>` has no gradient.** Mockup: `background:
   linear-gradient(96deg,#fbbf24,#fb923c 55%,#c4b5fd); -webkit-background-clip:text;
   -webkit-text-fill-color:transparent`. Current renders it as plain solid text — this is
   the single biggest visual gap on the page.
5. **CTA button doesn't match at all**: mockup uses a green→teal *gradient*
   (`linear-gradient(135deg,#10b981,#0ea86f)`) with **dark** text (`#04120c`, not white),
   `padding:15px 30px`, `border-radius:12px`, `font-size:15px`, plus a continuous
   diagonal shine-sweep (`::after` pseudo-element, `shine` keyframe, 3s loop) — README:
   "the 'make it feel less stiff, more inviting' upgrade over a static button." Current
   CTA is solid green, white text, smaller padding/radius/font, no shine sweep. The
   Google "G" logo SVG fill also needs to switch from white to the CTA's dark text color
   to stay legible against the lighter gradient.
6. **Trust pips row is completely missing.** Mockup has 3 small pill chips below the
   trust line — "🔒 Private", "⚡ Instant", "🤖 AI-checked" — README: "quick-scan
   reassurance texture, intentionally not more than 3." Current has no such row.
7. **Feature cards missing top accent bar + colored hover glow.** Mockup's `.gcard::before`
   is a 2px full-width colored strip per card (`background: var(--fc)`, the card's own
   accent color); hover lifts `-5px` with a `box-shadow` tinted in the card's own accent
   color (`color-mix(in srgb, var(--fc) 16%, transparent)`). Current cards have neither —
   only a neutral border/background hover, and no accent-colored top strip (the accent
   color only shows in the small icon square).
8. **No EN/TH i18n at all.** `LoginGate.tsx` is 100% hardcoded English — no `useLang()`,
   no Thai branch anywhere. Every other page in this app (`Header`, `Landing`,
   `MarketTicker`, all 3 dashboard routes) uses `useLang()`/`LanguageContext` for EN/TH.
   The mockup provides complete, ready-to-use Thai copy for every string on this page
   (title, subhead, CTA label, trust line, all 3 pips, all 4 feature titles/descriptions,
   footer line) — this is a real functional gap, not just a style miss, and the fix is
   mechanical (the Thai strings are already written; just wire them in).

## Decisions (scoping)

1. **This phase is closer to a rewrite than a retune**, given the scope of what's
   missing. Rather than dozens of tiny surgical edits risking a half-migrated file,
   Task 1 replaces the whole component body in one pass (still following the file's
   existing patterns: inline styles + one trailing `<style>` tag, `next/link`, no new
   dependencies) with the mockup's structure, and later tasks do focused polish/QA.
2. **i18n**: add `useLang()` from `@/lib/LanguageContext` (the exact hook every other
   component in this app already uses) and thread `th ? ... : ...` ternaries using the
   mockup's own provided Thai copy verbatim — no new translation work, just wiring.
3. **Auth flow unchanged**: the CTA still links straight to `/api/journal/auth/google`
   via a plain `<Link>` (not the mockup's demo `<button onClick={toggleAuth}>`, which is
   prototype-only fake-auth-toggle scaffolding, not a real flow) — this matches the
   existing, correct pattern already in the current file and in `Header.tsx`'s
   `AuthWidget`.
4. **Radar logo/favicon**: not touched by this file at all (it lives in `Header.tsx`,
   already correct from Phase 1).

## Explicitly NOT changed / non-goals

- No changes to `Header.tsx`, `MarketTicker.tsx`, `layout.tsx`, `Landing.tsx`, or any
  dashboard file (Phases 1-3, already done).
- No change to the actual auth mechanism (`fetchCurrentUser()`, `/api/journal/auth/google`
  redirect, `JournalContent.tsx` post-login UI) — purely the logged-out gate's visuals +
  i18n.
- No new npm dependencies.

## Testing

Same constraints as prior phases: no automated test suite for this file. Verification =
`npm run build` per task + curl against a live dev server for markup/copy/values (this
file is 100% inline styles, proven reliable in Phases 1-3), plus a code-level check for
the CSS-only shine-sweep/ring-pulse animations and hover states that curl can't visually
render but whose presence/values in the rendered `<style>` tag can be confirmed.
