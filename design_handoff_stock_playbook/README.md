# Handoff: Stock Playbook — Rebrand + Journal Login Gate

## Overview
Restyle of the Stock Playbook web app (formerly "Stock Radar Weekly"): full
rebrand across the landing page, the DCA/Catalyst/Turbo dashboard, and a new
Trade Journal login gate, plus header/ticker consistency work (avatar/login
state, expandable market-timing drawer, Journal nav entry).

## About the Design Files
The three `.dc.html` files in this bundle are **design references built as
self-contained HTML prototypes** — they demonstrate exact layout, color,
typography, copy, and interaction behavior (tab switching, ticker
expand/collapse, logged-in/out header state). They are **not** production
code to copy verbatim. The task is to **recreate these designs in the
target codebase's existing environment** — this is a Next.js 15 App Router
app (see `web/app/*.tsx`, `web/lib/*`) using inline-style React components,
`next/font/google` (Bricolage Grotesque, DM Sans, JetBrains Mono), and a
`LanguageContext` for EN/TH. Match its existing patterns (component split,
`useLang()` hook, CSS variables in `globals.css`) rather than inlining
`<style>` blocks the way the HTML prototypes do.

Open any `.dc.html` file directly in a browser to view/interact with it.

## Fidelity
**High-fidelity.** Colors, spacing, typography, copy (including Thai
translations), and animation timings below are final — implement pixel-
for-pixel using the codebase's existing component patterns, not the
prototype's raw inline CSS.

## Screens / Views

### 1. Landing (`Landing Restyled.dc.html` → maps to `web/app/Landing.tsx` + `web/app/page.tsx`)
**Purpose:** Home/hero — pick one of 4 "investment elements" (strategies).

**Layout:**
- Sticky header (see "Shared Header" below) + collapsible market ticker.
- `<main>` max-width 1120px, centered, `padding: 0 20px`.
- **Hero section** (`padding: 64px 0 44px`, `text-align:center`, `position:relative; overflow:hidden`):
  - Ambient glow (`.hglow`): absolutely positioned 900×520px div centered at top, `z-index:-1`, three overlapping `radial-gradient` ellipses — green `rgba(16,185,129,.10)` at 30%/40%, blue `rgba(56,189,248,.08)` at 70%/55%, amber `rgba(251,146,60,.07)` at 50%/70%. Pure ambient depth — **no radar rings, sweep animation, or radar iconography** here; that was removed per feedback.
  - `.hbadge`: pill, `background: var(--card) #0c0c14`, `border: 1px solid #1a1a2e`, `border-radius:999px`, `padding:6px 15px`, contains a pulsing green live-dot (7×7px circle, `animation: pulse 2s ease-in-out infinite`) + mono 11px muted text "LIVE · Updated {date}". **`white-space:nowrap`** on the badge (must not wrap to two lines at narrow widths).
  - `<h1>` "Stock Playbook" — Bricolage Grotesque 800, `clamp(34px,6.5vw,58px)`, letter-spacing -1.6px, gradient text `linear-gradient(96deg,#7dd3fc,#34d399 42%,#fb923c 74%,#e879f9)` via `background-clip:text`.
  - Subhead (mono-adjacent body font, `var(--muted) #64748b`, max-width 568px): "Pick your **investment element** — each is a different thesis in one playbook · institutional-grade analysis" (bold on "investment element" only). Thai: "เลือก**ธาตุการลงทุน**ของคุณ — แต่ละธาตุคือ thesis คนละแบบในเพลย์บุ๊กเดียวกัน · institutional-grade analysis". **Do not use the word "radar" in this copy** — earlier drafts said "on one radar"; that was corrected.
  - **No color-swatch legend row** (Water/Air/Fire/Earth bar) below the subhead — removed per feedback; keep the hero to badge + title + subhead only.
- **Element grid** (`.egrid`): `grid-template-columns: repeat(auto-fit, minmax(232px,1fr))`, gap 16px. 4 cards, each linking to the Dashboard (`href="Stock Playbook Dashboard.dc.html"` in the prototype → `/dashboard` or equivalent route in the real app):
  - **DCA** (Water 💧, `--c1:#38bdf8 --c2:#3b82f6`): "Quality core · hold 3–5 yrs · accumulate on valuation", LOW RISK, 3–5 yrs, 6 picks. Ambient: a wavy water-line at the card bottom (`.amb-water`, `animation: wave 3.8s`).
  - **Catalyst** (Air 🌬️, `--c1:#10b981 --c2:#34d399`): "Event-driven · weeks · trade upcoming catalysts", MED RISK, weeks, 4 picks. Ambient: 3 horizontal wind streaks drifting across (`.streak`, staggered `animation-delay`).
  - **Turbo** (Fire 🔥, `--c1:#ff6d00 --c2:#d500f9`): "Moonshot · 300%+ upside · high-risk, 2–5% per name", HIGH RISK, binary, 3 picks. Ambient: flickering flame gradient at bottom (`.amb-fire`, `clip-path` keyframe flicker).
  - **Earth** 🌍 (ghost/disabled card, opacity .55, no href): "Foundation — portfolio / track record · planned, not live", risk "—", "planned" / "soon".
  - Card: `border-radius:16px`, `border-top: 2px solid var(--c1)`, hover → `translateY(-5px)` + colored glow shadow. Each has a top-right radial "wash" glow in its accent color.
- **Tools row**: centered, "TOOLS" label (mono, uppercase, muted) + "📊 Backtest" and "📒 Journal" pill buttons (Journal in amber `#f59e0b`, links to the Journal login gate).

### 2. Dashboard (`Stock Playbook Dashboard.dc.html` → maps to `web/app/dca|catalyst|turbo` pages)
**Purpose:** Ranked list view for one of the three strategies, switchable via segmented control.

**Layout:**
- Same shared header + ticker as Landing.
- New **mini-hero** directly under the header (`.dhero`, `padding:30px 0 6px`, centered): the same LIVE/Updated badge as Landing, plus a one-line mono tagline "Pick your investment element below — re-ranked automatically every week." This ties the sub-pages back to the Playbook brand instead of dropping straight into a bare list.
- **Segmented switcher** (`.switch`): pill group, 3 buttons (💧 DCA / 🌬️ Catalyst / 🔥 Turbo), each with a count badge. Active pill gets a gradient fill in its theme color; inactive pills are transparent/muted. Client-side tab state (no page reload in the prototype — in the real app this is 3 separate routes).
- **Per-tab page header** (`.phead`): pulsing colored dot (`.pdot`, ping animation) + gradient `<h1>` title e.g. "💧 DCA · Long-term Core", plus a mono subtitle line with the ranking methodology, e.g. "5 ETFs · ranked by low cost + diversification + valuation · auto-DCA core".
- **Stats row**: 5 compact stat tiles (`.stats`, `grid-template-columns:repeat(auto-fit,minmax(120px,1fr))`) — label (9px mono uppercase muted) over a bold 18px value in a theme-relevant color. DCA: Top Pick / Avg Score / Accumulate / Below Fair / Total ETF. Catalyst: Top Pick / Avg TP2 Upside / Avg Score / Low Fed Risk / BUY Signals. Turbo: Top Pick / Avg Moon % / 300%+ count / 500%+ count / Total.
- **Tier row** (Catalyst/Turbo only): colored count pills e.g. "BUY ×3", "HOLD ×1", "SPEC ×1" / "🌙 500%+ ×1", "🔥 300%+ ×5", plus a muted "sorted by: …" tag on the right.
- **Gradient divider** then a **card grid** (`repeat(auto-fill, minmax(300px,1fr))`, gap 16px). Card anatomy is theme-driven via CSS custom properties set on a `.theme-water|air|fire` wrapper class (`--c1`, `--c2`, `--surface`, `--brd`, `--track`, `--glow`, `--tx`, `--mut`):
  - Rank badge (🥇🥈🥉 or #N) + circular score/moon-% ring (`conic-gradient` progress ring) top row.
  - Ticker + tag/verdict chip, name/cap, italic 2-line description (DCA only).
  - Price row with change chip (green up / red down) and a cadence or Fed-risk note.
  - **DCA-specific**: 2×2 chip grid (Tracks/Expense/Yield/10y CAGR) + a "Valuation vs Fair" gauge bar (3-zone cheap/fair/rich track with a colored marker dot) + zone label.
  - **Catalyst-specific**: 2-line summary paragraph, urgency chip (NOW/RAMP/PRE-EARN/WINDOW, color-coded), next catalyst date, upside % with a fill bar.
  - **Turbo-specific**: 3-up chip row (Market Cap / Fed Risk / Stop Loss) + a "Price → Moon" progress bar with a take-profit tick mark and a glowing current-price dot.
  - Card hover: `translateY(-4px)` + theme-colored glow shadow.
- **Footer note** per tab: colored icon + bold label + one-line risk/methodology disclaimer, ending "Not financial advice."

### 3. Journal login gate (`Journal.dc.html` → maps to `web/app/journal/LoginGate.tsx`)
**Purpose:** Convert a logged-out visitor into a Google-auth signup. This is the screen the "improve, feels stiff" feedback targeted — the version here is the up-styled one.

**Layout:**
- Same shared header/ticker, with the Journal nav item shown in its active/amber state and a **Login button** (not avatar) in the header since this is the logged-out state.
- **Gate section** (`max-width:900px`, centered, `padding:60px 20px`):
  - Ambient background: `.gglow` (two overlapping radial gradients, amber `rgba(245,158,11,.16)` + purple `rgba(139,92,246,.13)`) and two faint decorative rings (`.grings`, 200px/340px, opacity .35, static — not radar rings, just soft circles for depth).
  - **Icon**: 84×84px rounded-rect (`border-radius:20px`), amber→purple diagonal gradient fill, 📒 emoji centered, `box-shadow` amber glow, **floating animation** (`gfloat`, ±8px translateY + slight rotate, 3.6s loop) plus a **pulsing outline ring** around it (`.gicon-ring`, `ringPulse` 2.6s scale+fade loop) — this replaced the static icon in the original stiff version.
  - "✦ AI-POWERED" purple pill badge — **must have `white-space:nowrap`** (this wrapped to two lines in an earlier pass; keep it fixed).
  - `<h1>` "Trade Journal" — Bricolage Grotesque 800, `clamp(30px,5.5vw,46px)`, gradient `linear-gradient(96deg,#fbbf24,#fb923c 55%,#c4b5fd)`.
  - Subhead (mono, muted, max-width 500px): "Log every trade plan, let live prices + Claude keep watch, and see — with real numbers — whether you actually stick to your own rules."
  - **CTA button** "Log in with Google" (Google "G" logo SVG inline): green gradient (`#10b981→#0ea86f`), dark text, bold, `border-radius:12px`, glow shadow, hover → lift + scale (1.03) + stronger glow, plus a continuous **diagonal shine sweep** (`::after` pseudo-element, `shine` keyframe, 3s loop, mostly-idle with a quick sweep every cycle) — this is the "make it feel less stiff, more inviting" upgrade over a static button.
  - Trust line: "Free · Google login only, no password to manage".
  - **Trust pips row** (new): 3 small pill chips — "🔒 Private", "⚡ Instant", "🤖 AI-checked" — quick-scan reassurance texture, intentionally not more than 3 (avoid stat/data padding).
- **Feature grid** (`repeat(auto-fit,minmax(220px,1fr))`, gap 14px), 4 cards, each with a colored top accent bar (`::before`, 2px, per-feature accent color) and hover lift + colored glow:
  1. 🎯 blue `#3b82f6` — Plan-first logging
  2. ✦ purple `#8b5cf6` — AI plan validation
  3. 🚨 red `#ef4444` — Stop-loss alerts
  4. 📊 green `#10b981` — Win-rate & expectancy
  (Exact English/Thai copy for each is in the file — see `feats` array in the logic script.)
- Footer line: "Not financial advice · Your trades are private to your account".

## Shared Header + Ticker (all 3 screens — build once, reuse)
- **Top accent bar**: 3px full-width strip, `linear-gradient(90deg,#10b981,#3b82f6,#8b5cf6,#f59e0b,#10b981)` at `background-size:300% 100%`, animating position over 8s linear loop (`gradShift`).
- **Header row**: logo (26×26 rounded radar-mark SVG — **kept as-is, this is the app's icon/logo and should NOT be changed**) + "Stock Playbook" wordmark (Bricolage 800, 19px) on the left. Right side: DCA/Catalyst/Turbo gradient-text nav pills in a pill-group container → 📊 Backtest text link → 📒 Journal text link (amber, with a small pulsing ✦ spark next to it) → live-dot + "Updated {date}" → EN/TH segmented toggle → **auth widget**: a 30×30 circular avatar with initials (e.g. "JD") when logged in, or a solid green "Login" button when logged out.
- **Market ticker bar**: full-width strip below the header, amber-tinted background, a fixed "🟡 SELECTIVE" verdict pill on the left, an auto-scrolling news crawl in the middle (masked fade at both edges, pauses on hover), a fixed "🎯 Entry {date range}" pill on the right, and a chevron (▼) that rotates 180° and reveals an expandable drawer with a one-line market summary + a highlighted "BEST ENTRY WINDOW" callout box.
- Header collapses nav/updated/live-dot below 760px width; ticker's entry pill hides below 640px.

## Interactions & Behavior
- **Language toggle (EN/TH)**: swaps all copy including the crawl-ticker-independent hero/gate text; implemented as component state in the prototype (`lang` in state) — real app already has `LanguageContext`/`useLang()`, wire into that instead.
- **Ticker expand/collapse**: click the ticker bar to toggle the drawer; chevron rotates; crawl continues underneath.
- **Dashboard tab switch**: click a segmented pill to swap DCA/Catalyst/Turbo content (prototype does this client-side with no scroll reset; real app should route to `/dca`, `/catalyst`, `/turbo` as it already does per the existing codebase).
- **Journal auth**: clicking the CTA, the header Login button, or the header avatar toggles logged-in/out state in the prototype (for demo purposes only) — in the real app this hits `/api/journal/auth/google` per the existing `LoginGate.tsx`.
- **Hover states**: element/ranking/feature cards all lift (`translateY`) with a colored glow shadow on hover; nav links darken/brighten to `var(--text)`; CTA button lifts + scales + shadow intensifies.
- **Reduced motion**: all animations respect `prefers-reduced-motion: reduce` (durations forced to ~0).

## State Management
- `lang: 'en' | 'th'` — global, should live in the existing `LanguageContext`.
- `tickOpen: boolean` — per-page, local component state.
- `loggedIn: boolean | null` (Dashboard/Journal) — should come from the existing `fetchCurrentUser()` auth client, not local state (local state was only for prototyping).
- Dashboard `view: 'dca' | 'catalyst' | 'turbo'` — in the real app this is just routing, not state.

## Design Tokens
**Colors**
- Background: `#06060a` · Card: `#0c0c14` · Border: `#1a1a2e` / `#26264a` (bright)
- Text: `#e2e8f0` · Muted: `#64748b`
- Water/DCA: `#38bdf8` → `#3b82f6`
- Air/Catalyst: `#10b981` → `#34d399`
- Fire/Turbo: `#ff6d00` → `#d500f9`
- Earth (ghost): `#a16207` / `#3a3a2a`
- Amber (Journal/warnings): `#f59e0b`
- Purple (AI accents): `#8b5cf6` / `#c4b5fd`
- Semantic: success/up `#10b981`, danger/down `#ef4444`

**Typography**
- Display: Bricolage Grotesque, weights 600/700/800 — headlines, big numbers, wordmark
- Body: DM Sans, 400–700 — paragraph copy
- Mono: JetBrains Mono, 400/500/700 — labels, badges, stats, nav, all-caps eyebrows

**Spacing / radius**
- Content max-width: 1120px (app), 900px (Journal gate)
- Card radius: 14–16px · pill/badge radius: 6–9px, or 999px for full pills
- Standard gaps: 14–16px between cards, 8–20px internal padding

**Shadows**
- Card hover glow: `0 12–16px 34–44px {theme-color}@16-20% opacity`
- CTA glow: `0 10px 32px rgba(16,185,129,.4)` resting, `0 16px 44px rgba(16,185,129,.55)` on hover

## Assets
- Logo/favicon: inline SVG "radar mark" (navy rounded-square tile, concentric green rings, a rotated sweep line, 4 colored element blips, center dot) — see `favicon.svg` / `favicon-animated.svg` in this folder, and the inline `<symbol id="radar">` in each `.dc.html`. **This mark is unchanged from the original build — do not restyle it**, only the surrounding copy/theme was rebranded from "Stock Radar Weekly" to "Stock Playbook".
- Google "G" logo: inline SVG path in the Journal CTA button (see `Journal.dc.html`).
- Google Fonts loaded via `<link>` — real app already self-hosts these through `next/font/google` (see `web/app/layout.tsx`), no change needed there.
- All other icons are emoji (💧🌬️🔥🌍📒📊🎯✦🚨🌙), consistent with the existing app's icon style — no icon library needed.

## Files
- `Landing Restyled.dc.html` — home/hero, the 4-element picker
- `Stock Playbook Dashboard.dc.html` — DCA/Catalyst/Turbo ranked list views with tab switcher
- `Journal.dc.html` — Trade Journal logged-out gate (the "make it inviting" redesign)
- `favicon.svg`, `favicon-animated.svg` — the radar-mark logo, unchanged
- Open any `.dc.html` directly in a browser to interact with the live prototype (language toggle, ticker expand, tab switching, login toggle) before implementing.
