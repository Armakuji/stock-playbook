---
name: catalyst-refresh
description: >
  Refresh STALE reports on the /catalyst dashboard (web/data/reports/) so the visible board is
  current. Use this skill whenever the user asks to refresh the catalyst page, update stale picks,
  fix old reports, or says things like "catalyst page มี stale เยอะ", "refresh stale reports",
  "อัปเดตรายงานที่เก่า", "รีเฟรช dashboard", "update the catalyst board", "หุ้นบน catalyst เก่าแล้ว",
  or "refresh stale". This skill REFRESHES EXISTING picks only — it never screens or adds new
  tickers (that's `/catalyst-list`) and never re-ranks by entry attractiveness (that's
  `catalyst-compare`). For the turbo lane use the same flow against web/data/speculative/.
---

# Catalyst Refresh — keep the visible board honest

You are Stock Playbook Research. This skill has one job: **the picks a user actually sees on
`/catalyst` should not be built on stale data.** It re-researches and rewrites existing reports.
It does NOT screen new tickers and does NOT reorder the board by entry attractiveness.

## ⚠️ The one rule that matters most

**Never bump `generatedAt` without doing real research.** A refreshed `generatedAt` clears the
STALE banner on the site. If you rewrite a report with a new date but stale facts, you have not
fixed staleness — you have hidden it, and the user now trusts a number more than they should.
Every refresh in this skill means: new price, re-verified catalyst date, re-checked analyst
consensus, re-checked news since the last report. If you can't do that for a ticker, leave it
STALE and say so.

## Step 0: Read the feedback prior (advisory)

Check `web/data/skill-feedback.json`; skip if missing. Same two-tier convention as elsewhere —
read `core.tier2` rather than re-deriving it. Two fields bind on every report you write here:

- `stopGuidance` — `entryStrategy.stopLoss.tight` must be **wider** than the relevant `medianMAE`
  (per-type when that bucket has n ≥ 5, else `core.overall.medianMAE`) or carry a one-line
  justification.
- `entryGuidance.core` — **entry rule (backlog #40)**: if `medianPctAtAnchor` is negative with
  n >= 5, the refreshed report must NOT mark Entry 1 ("now") as `preferred`, and must quote the
  figure in `entryStrategy.verdict`. Refreshes are exactly where this slips — a pick that has run
  is the most tempting one to mark "buy now".
- `scenarioCalibration.core` — state the `optimismBiasBasePct` you wrote against; if Base exceeds
  `realizedMaxGainP75Pct`, name the horizon it assumes. Read `horizonCaveat` first.

## Step 1: Refresh live prices FIRST — before writing anything

This ordering is not optional. A report written against a stale quote is wrong the moment it is
saved (2026-08-13: a report was written at a search-derived $49.10 while the live price was
$53.82 — 9.6% off, enough to flip the pick from passing to failing its own upside gate).

```bash
cd web && npm run prices:fetch
```

**🚨 Verify the result before trusting it.** `scripts/fetch-live-prices.mjs` writes its output even
when every fetch fails, which silently replaces the cache with zero tickers (observed 2026-08-13:
0 fetched / 75 failed → `prices: {}`). After running it:

1. Read `web/data/live-prices.json` and check `generatedAt` is recent **and** `Object.keys(prices).length > 0`.
2. If the ticker count dropped to 0 or collapsed versus before, **restore it** and treat prices as
   unavailable: `git show HEAD:web/data/live-prices.json > web/data/live-prices.json`
3. If prices can't be refreshed (network blocked), **stop and tell the user** rather than
   refreshing reports against stale quotes. Give them the command to run locally. Refreshing on
   stale prices is worse than not refreshing.

## Step 2: Compute the visible board exactly as the page does

The user's complaint is always about what they can *see*, so scope to the visible board first:

- `rankReports(partitionStopped(getAllReports()).active)` from `web/lib/ranking.ts` (picks at/below
  their hard stop — `web/lib/stop-status.ts` — sit in the 🛑 Stopped strip, not on the board) — sorts by `timingTier(daysToCatalyst)`
  first, then `computeRankScore`
- filter `reportStage(r) !== "post"` (`web/lib/catalyst-timing.ts`)
- take the top `TOP_N` — currently **10**, defined in `web/app/catalyst/CatalystContent.tsx`

Use the latest report per ticker (highest date in filename). Read `TOP_N` from the file rather
than hardcoding 10 — if someone changes it, this skill should follow.

## Step 3: Score staleness — four signals, not just age

Report age alone under-detects. Compute all four per pick:

| Signal | Threshold | Source |
|---|---|---|
| **Report age** | `ageDays >= 7` | `StalenessBanner.tsx` — this is what shows the badge |
| **Price drift** | `abs(live - report.price) / report.price >= 8%` | `validate-reports.mjs` price-drift WARN |
| **Post-stage on its own events** | all `catalysts[]` dates now past | `reportStage()` |
| **Date inconsistency** | same event dated >14d apart across `catalysts[]` vs `estimateDates[]` | see below |

**Price drift is the strongest signal and is easy to miss** — it only works when `live-prices.json`
is current, which is why Step 1 comes first. On 2026-08-13, once prices were refreshed, 143 of 223
reports flagged drift; that check had been dormant while the cache sat 8 days stale.

**Date inconsistency check (the ASTS case, 2026-08-13):** `nextCatalyst()` pools dates from BOTH
`catalysts[]` and `estimateDates[]` and takes the earliest upcoming one. `estimateDates[]` has no
ISO field — only a human `dateRange` string — so a fuzzy badge there can silently outrank an
explicit `catalystDate`. ASTS dated its Japan J-LEO Award as `catalystDate: "2026-09-15"` but
`dateRange: "Q3 2026"`, which parses to 2026-08-15, so the site read it as 2 days away and ranked
it #3 on a board where its real event was 33 days out. When you find this, fix both fields to the
same date in the refreshed report and say so in the output.

Refresh priority: **post-stage + high drift** first, then drift, then age, then inconsistency.

## Step 4: Refresh each pick (use the `stock-report` skill)

For every ticker selected, run the full `stock-report` flow — that skill owns the research and
schema rules; do not re-implement them here. Refresh-specific requirements on top:

1. **Price comes from `live-prices.json`**, not from a search snippet. Set `priceChange` from the
   cached `changePct`. If a ticker is missing from the cache, fetch it individually and say so in
   `priceNote`.
2. **Re-verify the catalyst date against a primary source** (company guidance / SEC filing / FDA
   PDUFA letter). Never carry a date forward just because the previous report had it — and never
   accept a CT.gov *estimated completion* or an aggregator `AI-detected` row (backlog #37).
3. **Keep `catalystDate` and the matching `estimateDates[].dateRange` consistent.** If the exact
   day is known, write it in both. Reserve fuzzy badges for genuinely fuzzy events (CLAUDE.md rule 9).
4. **Note the drift in `priceNote`** — e.g. "Prior report (Aug 5) used $22.83 — +7.3% drift in 8
   days, which triggered this refresh." It shows the user why the number moved.
5. **If the thesis broke, say so in the first line of `summary`.** A refresh that quietly re-rates
   a broken pick is the worst outcome this skill can produce. Lead with `⚠️ THESIS BROKEN`, state
   what the prior report assumed, what actually happened, and that the old framing is void. Cut
   `verdict`, `score` and `catalystSpot.spotSizing.pct` to match — see `CAPR_20260813.json`, where
   a 9-3 negative FDA advisory vote invalidated a Base case of +70% and sizing went 3% → 1%.
6. **Old reports are never deleted.** Write a new `<TICKER>_<YYYYMMDD>.json`; the backtest reads
   the full history and needs the wrong ones intact.

## Step 5: Validate, commit

```bash
node scripts/validate-reports.mjs      # must be 0 blocking
git add web/data/reports/ web/data/live-prices.json
git commit -m "refresh: <TICKERS> on live prices (<reason>)"
git push origin <branch>
```

Expect the price-drift WARN count to stay high — those are the reports you did NOT refresh, and
that is the correct signal, not a failure. Report the actual branch pushed; if it isn't `main`,
say "merge to main to deploy", never "Vercel deploying".

## Step 6: Output

```
🔄 Catalyst Refresh — <N> of <TOP_N> visible picks were stale

prices: <count> tickers @ <generatedAt>  (or: NOT refreshed — <reason>)

refreshed:
  TICKER  $old → $new (<drift>%)  age <N>d  — <one line: what changed>

skipped (still stale):
  TICKER  age <N>d  drift <N>%  — <why not refreshed this run>

board: <N>/<TOP_N> now fresh
still stale board-wide: <N> reports · worst drift: TICKER <N>%
```

Then one paragraph (Thai/English mix, house style) on what actually changed in the theses —
not a restatement of the table.

## Scope boundaries

- **Never adds a ticker.** No screening, no gate, no longlist — that is `/catalyst-list`.
- **Never re-ranks by entry attractiveness** — that is `catalyst-compare`.
- **Never touches `web/data/market-timing.json`** — `/macro` only.
- **Never edits `near-misses.json`** — refreshing isn't screening.
- For the turbo lane, same flow against `web/data/speculative/` with the `turbo-report` skill;
  for DCA, `web/data/dca/` with `dca-report`.

## Trigger phrases

- "refresh stale reports" · "catalyst page มี stale เยอะ" · "อัปเดตรายงานที่เก่า"
- "refresh the catalyst board" · "รีเฟรช dashboard" · "หุ้นบน catalyst เก่าแล้ว"
- "fix the stale picks" · "update old reports on /catalyst"
