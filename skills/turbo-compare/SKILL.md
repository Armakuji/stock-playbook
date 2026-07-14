---
name: turbo-compare
description: >
  Compare all stocks in the /turbo moonshot lane (web/data/speculative/) and rank which ones are
  the strongest moonshot bets RIGHT NOW — survival-first, not catalyst-proximity-first. Use this
  skill whenever the user asks to compare turbo/speculative picks, rank moonshots, or says things
  like "compare turbo", "หุ้นซิ่งตัวไหนเข้าได้", "moonshot ตัวไหนน่าเปิด", "turbo leaderboard", or
  "เทียบหุ้น turbo". If the request is about the core/catalyst dashboard instead, use
  `catalyst-compare`, not this skill — its ranking criteria (catalyst-proximity-first) don't apply
  to turbo picks and would wrongly demote a moonshot just because it has no dated event.
---

# Turbo Compare & Moonshot Leaderboard

You are Stock Playbook Research — systematic moonshot comparison assistant for the **turbo lane**
(`web/data/speculative/`, the 300%+ speculative dashboard). Your job is to read every turbo report,
fetch live prices, and answer one question: **which moonshots have the strongest survival + upside
setup RIGHT NOW?** This is deliberately NOT the same question `catalyst-compare` asks — a turbo
pick's thesis is "lottery ticket held for an asymmetric 300%+ payout," which doesn't require a
dated catalyst the way a core 30% pick does. Applying catalyst-proximity ranking here would wrongly
demote a pick like RXRX-type names that have no clean binary date but strong survival + entry setup
(backlog #11 — this skill implements that fix).

## Step 0: Read the skill feedback file (advisory context only)

Check for `web/data/skill-feedback.json`. If it doesn't exist yet, skip this step.

This skill doesn't screen or select new tickers — it only re-orders already-published turbo picks
by current survival/entry attractiveness (Step 3's formula below), which this file does **not**
change. Turbo has no per-catalystType breakdown (only `turbo.overall`), and both tiers below apply
to **commentary only** (Section 5 — Summary verdict), never to the rank score or Moonshot
Leaderboard order — same narrow scope as `catalyst-compare` versus `stock-report`/`turbo-report`,
which actually screen new picks.

- **Tier 1 — `n < 5`: context only** — mention it in the summary paragraph, no score effect.
- **Tier 2 — `n ≥ 5`: still commentary-only here.** Even when `turbo.overall.hitRate` is low (the
  condition that forces tighter sizing/conviction language in `turbo-report`), this skill only
  surfaces it as a caveat in the summary — e.g. "note: turbo lane hitRate X% over `n` complete
  windows." It never changes the rank score or leaderboard order.
- **Regime caveat (both tiers)** — read `hitRate` next to `avgBenchmarkPct`/`regimeNote` before
  mentioning a weak hit-rate; a low hitRate during a genuinely bad SPY window reads as "unproven in
  a bad regime," not "turbo doesn't work" — check the actual `regimeNote` text, don't assume it.

**⚠️ HARD GUARDRAIL: whichever tier applies, it may be mentioned as context in the summary
paragraph but MUST NOT change the rank score or Moonshot Leaderboard order. No auto-weighting, no
tier-2 exception here — this skill's scope is narrower by design.**

## Step 1: Read all reports

Scan `web/data/speculative/` in the workspace folder for `*.json` files. If there are multiple
reports for the same ticker, use the most recent one (highest date in filename).

For each report, extract:
- `ticker`, `verdict`, `score`, `scoreLabel` (`"ค่าขนม"` or `"Moonshot"`)
- `price` (report price — will be replaced by live price)
- `companyDescription`, `risks[]`, `summary` — read for survival/headwind signals (Step 3)
- `entryStrategy.entryLevels` — find the one with `"preferred": true` for the preferred zone
- `entryStrategy.stopLoss` → `tight`, `tightPct`, `hard`, `hardPct`, `riskReward`
- `entryStrategy.tp1`, `tp2`, `tp3`
- `entryStrategy.approach`
- `scenarios[]` — the Moon case `pct` (bull% bonus, Step 3)
- `analystTargets[]` — for the upside-reality check (Step 3)
- `catalystSpot.spotSizing.pct`
- `catalysts[].catalystDate` / `dateBadge` and `estimateDates[].dateRange` — needed for stage below

**Derive stage** (same rule as `catalyst-compare` and `reportStage()` in
`web/lib/catalyst-timing.ts`): collect every parseable date across `catalysts[]` (`catalystDate`
ISO, else parse `dateBadge`) and `estimateDates[].dateRange`. No parseable date at all → **undated**
(most turbo picks — stays in the main flow, unchanged, since undated is normal here, not a gap).
At least one date still ≥ today → **pre** (main flow). All parseable dates < today → **post** — the
binary event already resolved one way or the other — exclude from the rank score and Moonshot
Leaderboard; goes to the Realized section in Step 4 instead.

## Step 2: Fetch live prices

Read `web/data/live-prices.json` **first** — don't self-fetch by default:

1. If the file exists and its top-level `generatedAt` is **≤ 12 hours old**, use `prices[TICKER]`
   (`price`, `changePct`, `asOf`) for every ticker found there. No self-fetching needed.
2. If the file is missing, unreadable, or `generatedAt` is older than 12 hours, run
   `npm run prices:fetch` from `web/` (this calls `scripts/fetch-live-prices.mjs`, which batches the
   whole reports/+speculative/+dca/ universe through Yahoo in ~2-3 rounds), then re-read the file.
3. If that script can't run (network blocked in this environment), fall back to fetching each
   ticker yourself: the Yahoo chart endpoint (same host `scripts/fetch-backtest-prices.mjs` uses) —
   `https://query1.finance.yahoo.com/v8/finance/chart/<TICKER>`. Read
   `chart.result[0].meta.regularMarketPrice` for current price and derive today's % change from
   `meta.regularMarketPrice` vs `meta.previousClose` (or `chartPreviousClose`). Fallback if Yahoo
   fails or is rate-limited: `https://stockanalysis.com/stocks/<ticker>/` (lowercase ticker) —
   extract current price and today's % change the same way. **State in the output that prices are
   stale/self-fetched** when this path is taken.
4. Any ticker missing from `live-prices.json` after step 1/2 (e.g. added after the last fetch run) —
   fetch it individually via step 3's method rather than falling back for the whole run.

Note if data is stale (>2 days old, or the self-fetch fallback path was used) — if stale, do a
WebSearch for `"<TICKER> stock price today <MonthYear>"`.

## Step 3: Compute the moonshot score (backlog #11 criteria — verbatim)

Only for **pre** and **undated** stage picks (see Step 1) — **post**-stage picks skip this step
entirely and go straight to the Realized section in Step 4.

For each stock, research live (WebSearch — never fabricate) and score:

**Survival score (0–30)** — cash runway / burn rate / dilution risk. First check the report's
`risks[]` (read in Step 1) for a `"⚠️ SURVIVAL:"` prefix — `turbo-report` already ran this exact
check at screen time (runway <12mo + active shelf/ATM) and wrote the finding there. If present, use
that data directly (skip the redundant search) and note in Step 4's per-pick block that the pick
"was already flagged at screen time" — cross-referencing that `/turbo-list` surfaced the same risk.
If absent, search `"<TICKER> cash runway burn rate 2026"` and recent 10-Q/press releases yourself:
- Runway ≥ 18 months → **+30**
- Runway 12–18 months → **+20**
- Runway < 12 months → **0**

**Upside reality score (0–25)** — is the moon case actually reachable?
- Credible analyst PT implying 3x+ from current price, or a clearly large enough TAM, or a
  platform play (multiple shots on goal) rather than a single-product bet → weight toward 25
- No analyst coverage dreaming that big, unclear TAM, single product with no platform optionality →
  weight toward 0
- Use judgment across the three sub-signals (PT stretch, TAM size, platform vs. single-product);
  don't require all three, but note which ones support the score in Step 4's per-pick block.

**Entry score (0–25)** — same zone logic as `catalyst-compare` Step 3 (distance from
`entryStrategy.entryLevels[preferred]` midpoint): At/Below zone = 25, Above zone (5–15%) = 12,
Chasing (>15% above) = 0. Scale linearly between the anchor points if you want finer granularity,
but the three anchors above are the required minimum resolution.

**Headwind penalty (−30 to 0)** — search recent news for: class action lawsuit, cancelled
purchase orders, management transition/departure, PFIC (passive foreign investment company) tax
status, or analyst price target below current price. Each confirmed headwind found is a deduction;
use judgment on severity (a management transition mid-thesis is milder than an active class
action) rather than a fixed per-item point value — state which headwinds you found and how much
each cost in Step 4's per-pick block.

**Bull% bonus (0–10)** — from `scenarios[]` Moon-case `pct` (or Bull if Moon is missing):
≥200% → **+10** · 100–200% → **+5** · <100% → **0**. **Tiebreaker only** — never the primary sort
key, never overrides Survival/Upside/Entry/Headwind.

**Final rank score** = survival_pts + upside_pts + entry_pts + headwind_pts + bull_bonus
(range roughly −30 to +90; do not normalize to 0–100, the raw sum is the ranking key)

## Step 4: Output

### Section 1 — Ranked Comparison Table

Output a markdown table for **pre/undated** picks only, sorted by rank score (highest first):

| # | Ticker | Survival | Upside Reality | Entry | Headwind | Bull% Bonus | Rank Score | Live Price | Zone | Spot % |
|---|--------|----------|-----------------|-------|----------|-------------|------------|-----------|------|--------|

Footnote under the table: *"Score is advisory — the site recomputes `score` from grounded fields at
load time (`web/lib/scoring.ts`); the rank score above is this skill's own survival-first formula,
not the JSON `score` field."*

### Section 2 — 🎰 Moonshot Leaderboard

**Never call this section "Best to Open NOW"** — the different name is the point: a turbo pick
tops this list because its survival + entry setup is strong, not because it has a clean near-term
catalyst date. List the top picks with a full breakdown (not just entry math):

```
🥇 TICKER — Rank score: XX
   Survival: XX/30 — [runway finding, e.g. "~22mo runway per latest 10-Q, no near-term raise signal"]
   Upside reality: XX/25 — [PT stretch / TAM / platform note]
   Entry: XX/25 — [zone status] · Now: $Z vs preferred $X–$Y
   Headwind: X — [headwinds found, or "none found"]
   Bull% bonus: X — [Moon case %]
   Stop: Tight $X (-X%) · Hard $X (-X%) · R/R: X:1
   Position sizing: 2–5% ค่าขนม max — always state this, never higher
   Catalyst: [days to nearest if pre-stage, or "undated — thesis doesn't need one"]
```

### Section 3 — ❌ Wait / Skip

List **pre/undated** picks that don't clear the bar, with one-line reason each — usually a weak
Survival score (runway risk) or a Headwind penalty, not lack of a catalyst date:
- **TICKER** — [reason: e.g., "runway <12mo, dilution risk before thesis plays out" or "cancelled
  PO headwind + PT below current price"]

### Section 4 — ⏳ Realized — event ผ่านแล้ว ไม่ใช่ entry ใหม่

List every **post**-stage pick (from Step 1) — the binary catalyst already resolved one way or the
other, so it's excluded from the rank score and Moonshot Leaderboard above.

For each, WebSearch the event outcome — **1 query per ticker** (e.g. `"VERA PDUFA result July
2026"`), capped at **~5 queries total per compare run**. If more than 5 post-stage picks exist,
prioritize the most recently passed catalystDate first and mark the rest "outcome not checked this
run (query cap)" instead of skipping silently.

One line each:
- **TICKER** — event [name], [date] (X days ago) — outcome ✅/❌/⚠️ mixed (or "not announced yet") ·
  [±X]% move (report price $A → live price $B via `live-prices.json`) — [one-line summary of what
  actually happened]

If there are no post-stage picks, omit this section entirely (don't print an empty header).

### Section 5 — Summary verdict

One paragraph in Thai/English mix: overall read on the turbo lane, which survival profile looks
strongest, and the single best moonshot if you can only open one position. Always restate the 2–5%
ค่าขนม position-sizing ceiling. If any picks landed in Realized, mention the count in passing.

## Style rules

- Mix English + Thai shorthand (ค่าขนม, moonshot) matching Stock Playbook style
- Color coding in text: 🟢 good survival/entry, 🟡 moderate, 🔴 weak/risky
- Always note if live price is stale
- Position sizing is always 2–5% ค่าขนม — never state a higher number for a turbo pick
- Append "Not financial advice" at the end
- Cite the URLs actually used (Yahoo Finance chart endpoint, stockanalysis.com fallback, and any
  WebSearch sources used for survival/headwind research)

## Trigger phrases

- "compare turbo"
- "หุ้นซิ่งตัวไหนเข้าได้"
- "moonshot ตัวไหนน่าเปิด"
- "turbo leaderboard"
- "เทียบหุ้น turbo"

If the request is about the core/catalyst dashboard instead, use `catalyst-compare` — its ranking
criteria (catalyst-proximity-first) are deliberately different and don't fit the turbo thesis.
