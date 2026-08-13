---
name: turbo-refresh
description: >
  Refresh STALE reports on the /turbo moonshot dashboard (web/data/speculative/) so the visible
  leaderboard is current. Use this skill whenever the user asks to refresh the turbo page, update
  stale moonshots, or says things like "refresh turbo", "turbo page มี stale เยอะ", "อัปเดตหุ้นซิ่ง",
  "รีเฟรช turbo", "update the moonshot board", "หุ้น turbo เก่าแล้ว", or "fix stale turbo picks".
  This skill REFRESHES EXISTING picks only — it never screens or adds new tickers (that's
  `/turbo-list`) and never re-ranks by survival/entry attractiveness (that's `turbo-compare`).
  For the core catalyst lane use `catalyst-refresh`, not this skill — the two lanes go stale for
  structurally different reasons.
---

# Turbo Refresh — keep the moonshot leaderboard honest

You are Stock Playbook Research. This skill re-researches and rewrites existing reports in
`web/data/speculative/` so the `/turbo` board isn't built on stale data. It does NOT screen new
tickers and does NOT reorder by survival/entry attractiveness.

## ⚠️ Why turbo goes stale differently from catalyst — read this first

`/catalyst` ranks by catalyst proximity, so staleness **self-corrects**: dates pass, picks sink.
`/turbo` ranks by `basePct` — a number *written into the report's `scenarios[]`* and never
recomputed against live price (`rankTurboReports` in `web/lib/speculative.ts`, sorted
`b.basePct - a.basePct` with `moonPct` as tiebreak). So when a turbo pick runs, its stale report
keeps advertising the original upside and **holds a rank it no longer deserves**. Staleness here
actively inflates the board rather than decaying out of it.

Measured 2026-08-13: AREC displayed at rank 3 claiming Base +90%, but only **+50%** remained to
that same target price after a +26.7% run — it belonged at rank 15. Six of the top ten were
over-ranked the same way.

Two more turbo-specific differences:

- **`/turbo` does NOT filter post-stage picks.** `web/app/turbo/page.tsx` calls
  `rankTurboReports(getAllSpeculativeReports())` with no `reportStage` filter, so a pick whose
  binary event already resolved stays on the leaderboard indefinitely, still claiming its
  pre-event upside. On `/catalyst` those get filtered out. Here you must catch them.
- **Turbo now HAS a `byType` breakdown and its own `tier2`** (added 2026-08-13, backlog #39 —
  earlier versions of this file said otherwise). Read `turbo.tier2` the same way the core lane
  reads `core.tier2`: it is precomputed and already enforces the n ≥ 5 floor. It may tighten
  sizing/conviction language on a rewritten report, but it **never changes leaderboard order** —
  that comes from `basePct` alone.

## Step 0: Read the feedback prior

Check `web/data/skill-feedback.json`; skip if missing. Use the **`turbo`** block, not `core`:

- `turbo.targetPct` / `turbo.softTargetPct` — the lane's bars are **+50%/30d** and **+20%/30d**,
  not the core +30%/14d. Never quote core numbers in a turbo report.
- `turbo.overall.medianMAE` — **currently around -24%, far wider than core's -14%.**
  `entryStrategy.stopLoss.tight` must sit wider than this or carry a one-line justification.
  A core-width stop on a turbo name is guaranteed to fire on noise.
- **Rank on metrics that vary, not `hitRate`.** Turbo's `hitRate` is ~4.9% (2 hits in 41) — not
  degenerate like core's 0%, but close. `softHitRate` (~22%), `medianExcessVsBenchPct` and
  `beatBenchRate` (~56%) carry far more signal. Report `hitRate` as the honest scoreboard.
- `turbo.tier2` — precomputed laggards/leaders at n ≥ 5. If a pick's `catalystType` is a laggard,
  it needs visibly higher conviction to keep its sizing. Note as of 2026-08-13 `partnership_win`
  is the laggard in **both** lanes independently (core -1.6 vs +1.4 n=12; turbo -3.8 vs +2.0
  n=16) — a stronger signal than either lane alone.
- `entryGuidance.turbo` — **entry rule (backlog #40)**: if `medianPctAtAnchor` is negative with
  n >= 5, the refreshed report must NOT mark Entry 1 ("now") as `preferred`, and must quote the
  figure in `entryStrategy.verdict`. Refreshes are exactly where this slips — a pick that has run
  is the most tempting one to mark "buy now".
- `scenarioCalibration.turbo` — same rule as everywhere: state the `optimismBiasBasePct` you wrote
  against, and if Base exceeds `realizedMaxGainP75Pct`, name the horizon. This matters more here
  than anywhere, because Base **is the sort key** for the whole board.

## Step 1: Refresh live prices FIRST — before writing anything

Not optional. See `catalyst-refresh` for the full reasoning; the same failure applies.

```bash
cd web && npm run prices:fetch
```

**🚨 Verify before trusting.** `scripts/fetch-live-prices.mjs` writes its output even when every
fetch fails, silently replacing the cache with zero tickers (observed 2026-08-13: 0 fetched / 75
failed). After running it:

1. Check `generatedAt` is recent **and** `Object.keys(prices).length > 0`.
2. If the count collapsed, restore and treat prices as unavailable:
   `git show HEAD:web/data/live-prices.json > web/data/live-prices.json`
3. If prices can't be refreshed, **stop and tell the user.** Refreshing a turbo report on a stale
   quote is worse than not refreshing — the whole point of this lane's refresh is repricing
   `basePct` against a real number.

## Step 2: Compute the visible leaderboard exactly as the page does

- `rankTurboReports(getAllSpeculativeReports())` from `web/lib/speculative.ts`
- sorted by `basePct` desc, tiebreak `moonPct` desc — **no stage filter**
- take the top `TURBO_DISPLAY_LIMIT` — currently **10**, in `web/app/turbo/TurboContent.tsx`

Latest report per ticker (highest date in filename). Read the limit from the file, don't hardcode.

## Step 3: Score staleness — five signals

| Signal | Threshold | Why |
|---|---|---|
| **Base decay** ⭐ | claimed `basePct` − remaining upside ≥ **15pp** | The turbo-specific one. See formula below |
| **Price drift** | `abs(live − report.price) / report.price >= 15%` | Higher bar than catalyst's 8%: turbo's median MAE is ~1.7x core's, so 8% here would flag nearly everything |
| **Report age** | `ageDays >= 7` | What shows the STALE badge |
| **Post-stage** | all dated catalysts now past | The page does not filter these — they linger claiming pre-event upside |
| **Date inconsistency** | same event dated >14d apart across `catalysts[]` vs `estimateDates[]` | `estimateDates[]` has no ISO field, so a fuzzy badge can outrank an explicit `catalystDate` |

**Base decay formula** — the one that matters most here:

```
target_price   = report.price * (1 + basePct/100)
remaining_pct  = (target_price / live_price - 1) * 100
decay_pp       = basePct - remaining_pct
```

`decay_pp` large and positive = the stock ran, the report still claims the old upside, the board
over-ranks it. Negative = the stock fell and the pick is *under*-ranked (also worth refreshing,
but lower priority — it understates rather than oversells).

Refresh priority: **post-stage** first, then **base decay**, then drift, then age, then
inconsistency. Post-stage outranks everything because an unresolved-looking report for a resolved
event is the most misleading artifact this board can show.

## Step 4: Refresh each pick (use the `turbo-report` skill)

Run the full `turbo-report` flow — that skill owns research, schema and the moonshot framing.
Refresh-specific requirements on top:

1. **Price from `live-prices.json`**, never a search snippet. Set `priceChange` from `changePct`.
2. **Re-derive `scenarios[]` from the live price, not from the old report.** Because `basePct` is
   the sort key, carrying forward a stale Base is the single worst thing you can do here — it
   re-publishes the exact distortion this skill exists to remove. State the old and new Base in
   `priceNote` or `summary` when it moved materially.
3. **Re-check survival, not just upside.** Turbo names are small caps whose real risk is running
   out of money: cash runway, recent raises, dilution, going-concern language, delisting notices.
   A moonshot that quietly became a financing story must say so in `risks[]` and `summary`.
4. **Re-verify catalyst dates against a primary source** — company guidance / SEC filing / FDA
   letter. Never a CT.gov estimated completion or an aggregator `AI-detected` row (backlog #37).
   Keep `catalystDate` and the matching `estimateDates[].dateRange` consistent; use a `~` prefix
   (e.g. `"~Sep 30, 2026"`) when only the month/quarter is known, so the fuzzy string parses to
   null instead of inventing a phantom date.
5. **Sizing stays 2–5% strict max** (`turbo-report` rule). Improved fundamentals never justify
   exceeding it — that ceiling is what makes the lane survivable.
6. **If the binary resolved, say so in the first line of `summary`.** A moonshot whose event has
   passed is no longer a moonshot: restate what happened, re-rate the verdict, and cut sizing.
   `scoreLabel` moves off `"Moonshot"` when the asymmetry is gone.
7. **Old reports are never deleted** — write a new `<TICKER>_<YYYYMMDD>.json`; the backtest reads
   the full history.

## Step 5: Validate, commit

```bash
node scripts/validate-reports.mjs      # must be 0 blocking
git add web/data/speculative/ web/data/live-prices.json
git commit -m "turbo-refresh: <TICKERS> on live prices (<reason>)"
git push origin <branch>
```

Report the actual branch. If not `main`, say "merge to main to deploy", never "Vercel deploying".

## Step 6: Output

```
🎰 Turbo Refresh — <N> of <LIMIT> visible moonshots were stale

prices: <count> tickers @ <generatedAt>  (or: NOT refreshed — <reason>)

refreshed:
  TICKER  $old → $new (<drift>%)  base <old>% → <new>%  decay <N>pp  — <one line>

base-decay leaderboard distortion (before refresh):
  TICKER  displayed #<n> claiming <base>% · only <remaining>% left · belongs at #<true>

skipped (still stale):
  TICKER  age <N>d  decay <N>pp  — <why not this run>

board: <N>/<LIMIT> now fresh
still stale lane-wide: <N> of <total> reports · worst decay: TICKER <N>pp
```

Then one paragraph (Thai/English mix, house style) on what changed in the theses — especially any
pick whose binary resolved or whose story turned into a financing problem.

## Scope boundaries

- **Never adds a ticker** — that's `/turbo-list`.
- **Never re-ranks by survival/entry attractiveness** — that's `turbo-compare`.
- **Never touches `web/data/market-timing.json`** — `/macro` only.
- **Never edits `near-misses.json`** — refreshing isn't screening (turbo entries use `lane: "turbo"`).
- **Never touches `web/data/reports/`** — that's `catalyst-refresh`.

## Trigger phrases

- "refresh turbo" · "turbo page มี stale เยอะ" · "อัปเดตหุ้นซิ่ง" · "รีเฟรช turbo"
- "update the moonshot board" · "หุ้น turbo เก่าแล้ว" · "fix stale turbo picks"
