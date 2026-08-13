---
description: Find the 5 best moonshot plays (≥200–300% bull case) → /turbo
---
Run `/turbo-list`: load `turbo-report` and use its "Step 0" + "List mode" sections.

0. Read `web/data/skill-feedback.json` if it exists (skip if missing) — use the **`turbo`** block as
   an advisory prior. Never quote `core` numbers here: the bars and windows differ (+50%/30d vs
   +30%/14d). Ranking stays upside-first per the current spec — base-case % primary, moon %
   tiebreaker, per Step 1 below; survival-first ranking is backlog #11 and not yet implemented.
   **Both tiers affect sizing/conviction language only, never rank order.**

   **Do NOT rank on `hitRate`.** Turbo's is ~4.9% — two hits in 41 completed windows. Report it as
   the honest scoreboard against the +50%/30d goal, but judge on the metrics with variance:
   `medianExcessVsBenchPct` (primary), `softHitRate` (+20% bar, ~22%), `beatBenchRate` (~56%).

   - **Tier 1 — `n < 5`:** context only. Mention it, never a reason to include/exclude/re-rank.
   - **Tier 2 — `n ≥ 5`: MUST be applied — read `turbo.tier2`, don't re-derive it.** Turbo gained a
     per-catalystType breakdown on 2026-08-13 (backlog #39); it previously had only `turbo.overall`
     and this step said so. `turbo.tier2` precomputes `metric`, `overallValue`, `eligible[]`,
     `laggards[]`, `leaders[]`, `fired` and already enforces the n ≥ 5 floor. Picks whose primary
     `catalystType` is a laggard need visibly higher conviction to justify their sizing — name the
     type, its value, and the overall figure. If `fired` is false, say so explicitly.
     **Cross-lane signal:** `partnership_win` is currently the laggard in BOTH lanes independently
     (core -1.6 vs +1.4, n=12; turbo -3.8 vs +2.0, n=16) — 28 completed windows across two
     different bars agreeing. Weigh that on any partnership-driven moonshot thesis.
   - **Whole-lane sizing check (unchanged):** if `turbo.overall.n ≥ 5` and the lane's rates are
     weak, tighten sizing/conviction across ALL picks this run and say so.
   - **Regime caveat (both tiers):** read any rate next to `avgBenchmarkPct`/`regimeNote` — a low
     rate during a window where `regimeNote` shows SPY broadly down is "unproven in a bad regime,"
     not "turbo doesn't work." Check the actual `regimeNote` text every run (SPY won't catch a
     sector-only selloff — a known gap in this rough v1 signal).
   - **Stops:** `turbo.overall.medianMAE` is ~-24%, far wider than core's -14%. Every pick's
     `stopLoss.tight` and `stopPreCatalyst` must clear the relevant `medianMAE` (`turbo.byType[]`
     when that bucket has n ≥ 5, else overall) or carry a one-line justification.
   - **🚪 Entry (`entryGuidance.turbo`, backlog #40).** Measured median return from report price to
     just after the catalyst. If negative with n >= 5, Entry 1 ("now") must not be `preferred` —
     prefer the dip entry and quote the figure in `entryStrategy.verdict`. Turbo currently reads
     worse than core on this, so it binds harder here.
   - **Scenarios:** use `scenarioCalibration.turbo`, NOT a pooled figure — the calibration was split
     per lane on 2026-08-13 because pooling mixed core Base (~35%) with turbo Base (~65-100%) across
     14d and 30d windows. Turbo's bias runs far hotter (+72.7pp vs core's +23.7pp). State the bias
     you wrote against; justify any Base above `realizedMaxGainP75Pct` with a stated horizon.

   **Print this block in chat before screening — a step with no visible output is a step that
   silently gets skipped:**
   ```
   📊 Feedback prior (skill-feedback.json, generated <date>):
     turbo: n=<n> complete=<k> · hitRate <x>% (North Star, aspirational) · softHitRate <x>% (+<soft>%) · beatBench <x>%
     rank metric: <turbo.tier2.metric> · overall <turbo.tier2.overallValue>
     tier-2: <FIRED — <type> at <value> vs overall <overallValue> (n=<n>) | not fired — no n≥5 bucket ≥2pp below overall>
     leaders: <type (value, n) | none>
     regime: SPY median <x>% over windows (n=<n>)
     entry: median at-catalyst <x>% · <x>% underwater at their event (n=<n>)
     stops: turbo medianMAE <x>% → tight stop must be wider
     scenarios: turbo Base bias +<x>pp vs realized · P75 <x>%
     guardrail: n<5 = context only · n≥5 = MUST apply (sizing/conviction, never rank order)
   ```
   If the file doesn't exist, print `📊 Feedback prior: skill-feedback.json not found — skipping` instead.
1. **First, assemble a candidate longlist (≥12 tickers spanning ≥4 distinct sectors/catalyst
   types)** before any deep research — source broadly: FDA/PDUFA calendars, launch schedules,
   contract-award pipelines, recent small-cap screens — not just famous speculative names pulled
   from memory (salience bias is exactly what produces repeat picks like ASTS/RXRX/QUBT/RCAT
   regardless of whether they're actually the strongest moonshots available this run — see backlog
   #35). One line per candidate: `TICKER · market cap · binary catalyst · rough bull-case % · why
   ≥200–300% is credible`. Flag two more things per candidate:
   - **cap check:** market cap ≤ $5B? (>$5B needs a stated 300%+ path or gets cut per this skill's
     own Step 1 qualification screen)
   - **survival pre-check:** a one-word runway read from a quick search — `ok` / `tight` / `flag`.
     This is triage only, not the full check — `turbo-report` Step 2/3 (#33) still does the real
     runway+shelf verification before any report gets written; the point here is not to burn deep
     research on a pick that will trip the `⚠️ SURVIVAL:` flag with no offsetting story.
   **Print the longlist in chat before narrowing to 5** — a step with no visible output is a step
   that silently gets skipped. Then screen for the 5 best small/mid-cap moonshots (≥200–300% bull
   case + binary catalyst), rank by most possible upside (base-case % primary, moon % tiebreaker),
   generate a turbo report for each → save to `web/data/speculative/`. A pick that trips
   `turbo-report`'s survival check (runway <12 months + active shelf/ATM → `risks[]` gets a
   `"⚠️ SURVIVAL:"` prefix, see Step 2/3 of that skill)
   is not a hard ban from the top 5, but its `summary` must name the survival risk and give an
   explicit special justification for including it anyway — silence is not acceptable. Ranking axis
   stays upside-first (unchanged) — this is a disclosure rule, not a re-rank.
2. Log runners-up (passed the moonshot screen but missed top 5) to `web/data/near-misses.json` —
   same shape as `/catalyst-list`'s near-miss entries (`date`, `ticker`, `reason`, `priceAtScreen`,
   `topAnalystTarget`, `impliedUpside`) plus `"lane": "turbo"`. `impliedUpside` must be a real
   number — if target data is noisy, log a best-effort estimate and say so in `reason`; never write
   `null`, it breaks the counterfactual math. Log **every** longlist candidate that doesn't make the
   top 5 — including ones cut before deep research at Step 1 — so the counterfactual covers
   candidate *generation*, not just the final cut. For those cut pre-research, `reason` starts with
   `"longlist-cut: "` followed by the one-line reason (e.g. cap check failed, survival pre-check
   flagged with no offsetting story) — `topAnalystTarget`/`impliedUpside` may be a best-effort
   estimate for these, but still a real number, never `null`.
3. Validate, `git add web/data/speculative/ web/data/near-misses.json`, commit, push once.
4. **Refresh STALE carryovers still on the visible board.** Same pain as `/catalyst-list` Step 5:
   the `/turbo` route shows the **top-10** (`TURBO_DISPLAY_LIMIT` in
   `web/app/turbo/TurboContent.tsx`) of ALL speculative reports, ranked by upside — base-case %
   primary, moon % tiebreaker (`rankTurboReports` in `web/lib/speculative.ts`) — not just the 5 you
   screened this run. Older moonshots keep ranking high on their frozen upside numbers while their
   report ages past 7 days and shows STALE (`ageDays >= 7` in
   `web/app/report/[ticker]/StalenessBanner.tsx`). Because turbo ranks on upside (not catalyst
   proximity, which naturally ages picks off the board), stale carryovers pile up worse here — a
   run refreshing only 5 can leave most of the top-10 stale.
   After Step 3, compute the visible board the same way the page does —
   `rankTurboReports(getAllSpeculativeReports())`, take the top 10 — and for **every ticker in that
   top-10 that is NOT one of the 5 you just wrote AND whose latest report is >=7 days old**, re-run
   the single-ticker `/analyze-turbo` flow (`turbo-report` skill: fresh research -> new
   `web/data/speculative/<TICKER>_<today>.json`). Print the list first (e.g. `refreshing STALE turbo
   top-10 carryovers: INO SOUN AREC FLY BTBT SERV PDYN`). Validate + commit + push these together
   with (or right after) the 5. Goal: the entire visible top-10 is fresh. If none is stale, print
   `turbo top-10 carryovers all fresh - none to refresh`.
5. Report the actual branch pushed. If it's not `main`, say "pushed to `<branch>` — merge to main
   to deploy", never "Vercel deploying". Visible at `/turbo` once on `main`.

No market-timing step — that's `/macro`-only.
