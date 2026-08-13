---
description: Generate the catalyst dashboard — screen 5 best 20%+ catalyst plays (catalyst within ~6 weeks)
---
Run the `/catalyst-list` workflow from CLAUDE.md (the catalyst dashboard; formerly /dashboard).

0. Read `web/data/skill-feedback.json` if it exists (skip if missing) — use as an **advisory prior**.

   **Do NOT rank on `hitRate`.** The North Star bar (+30%/14d) is aspirational and currently reads
   **0% in every single bucket** — a metric that is 0 everywhere cannot discriminate between
   catalyst types, and the old "hitRate below overall" rule could therefore never fire (0 vs 0 = no
   divergence). Keep reporting `hitRate` — it is the honest scoreboard against the stated goal —
   but rank on the metrics that actually vary:
   - `medianExcessVsBenchPct` — median (max gain − SPY over the same window). Primary.
   - `softHitRate` — % of windows that reached `core.softTargetPct` (+10%). Secondary.
   - `beatBenchRate` — % of windows that beat SPY at all. Sanity check.

   - **Tier 1 — `n < 5`:** context only. Mention it, never a reason to include/exclude/re-rank a pick.
   - **Tier 2 — `n ≥ 5`: MUST be applied — and do NOT re-derive it by eye.** `core.tier2` is
     precomputed by `scripts/build-skill-feedback.mjs`: it names the ranking `metric`, the
     `overallValue`, every `eligible` bucket (n ≥ 5), the `laggards` (≥ 2pp below overall) and the
     `leaders`. If `core.tier2.fired` is true, each pick whose primary `catalystType` appears in
     `laggards` needs visibly higher upside/conviction to make the top 5, and you must name the
     type, its metric value, and the overall value in your screening reasoning. If `fired` is
     false, say "tier-2 not fired — no n≥5 bucket sits ≥2pp below overall."
   - **Leaders are not a licence.** A bucket in `core.tier2.leaders` is a mild tailwind for a pick
     you already like on fundamentals — never a reason to add a pick whose catalyst or upside
     doesn't stand on its own. The `n` on these buckets is still small.
   - **Regime caveat (both tiers):** always read any rate next to `avgBenchmarkPct`/`regimeNote` —
     a low rate during a window where `regimeNote` shows SPY broadly down is "unproven in a bad
     regime," not "this type doesn't work." Check the actual `regimeNote` text every run, don't
     assume the story repeats (SPY won't catch a sector-only selloff — a known gap in this rough
     v1 signal, e.g. `earnings_beat` once read 0/12 hitRate with a *calm* regimeNote, meaning the
     miss was NOT regime-excused that time).
   - **Stops:** `stopGuidance` gives the measured median drawdown. Every pick's `stopLoss.tight`
     must be wider than the relevant `medianMAE` or carry a one-line justification — see
     `stopGuidance.rule` and its `caveat` (MAE is measured from the report price, i.e. an Entry-1
     fill, so it overstates the drawdown for a pick filled on the Entry-2 dip).
   - **🚪 Entry (`entryGuidance.core`, backlog #40) — the prior that changes the recommendation.**
     `medianPctAtAnchor` is the measured return from report price to just after the catalyst. If it
     is negative with n >= 5, **Entry 1 ("now") must not be `preferred` on any pick this run** —
     prefer the dip entry and say so in each `entryStrategy.verdict`, quoting the figure. Overriding
     requires a named setup-specific reason, not "strong thesis".
   - **Scenarios:** `scenarioCalibration.core.rule` — state the measured `optimismBiasBasePct` you wrote
     against, and justify any Base above `realizedMaxGainP75Pct` with an explicit horizon. Read
     `horizonCaveat` first: realized figures are 14d/30d, written scenarios usually aren't, so a
     positive bias is a prompt to state your clock, not proof the scenario was wrong.

   **Print this block in chat before screening — a step with no visible output is a step that
   silently gets skipped:**
   ```
   📊 Feedback prior (skill-feedback.json, generated <date>):
     core: n=<n> complete=<k> · hitRate <x>% (North Star, aspirational) · softHitRate <x>% (+<soft>%) · beatBench <x>%
     rank metric: <core.tier2.metric> · overall <core.tier2.overallValue>
     tier-2: <FIRED — <type> at <value> vs overall <overallValue> (n=<n>) | not fired — no n≥5 bucket ≥2pp below overall>
     leaders: <type (value, n) | none>
     regime: SPY median <x>% over windows (n=<n>)
     entry: median at-catalyst <x>% · <x>% of picks underwater at their event · timing gap <x>pp (n=<n>)
     stops: core medianMAE <x>% → tight stop must be wider
     scenarios: Base bias +<x>pp vs realized · P75 <x>%
     guardrail: n<5 = context only · n≥5 = MUST apply (see tier-2 line)
   ```
   If the file doesn't exist, print `📊 Feedback prior: skill-feedback.json not found — skipping` instead.
1. **First, assemble a candidate longlist (≥12 tickers spanning ≥4 distinct `catalystType`s)** before
   any deep research — source broadly: upcoming earnings calendars, FDA/PDUFA calendars, product
   launch schedules, 52-week-low bounces with a dated event — not just "famous AI names" pulled from
   memory (salience bias is exactly what produces repeat mega-cap picks whose real near-term odds are
   near-zero by market-cap physics alone — see backlog #34). One line per candidate:
   `TICKER · cap tier (mega ≥$200B / large $10–200B / smid <$10B) · catalyst + approx date · date
   provenance · why it might clear +20%`. **Print the longlist in chat before narrowing to 5** — a
   step with no visible output is a step that silently gets skipped. **Self-check:** if the top 5 you
   cut down to ends up all mega-cap, state in one sentence why each one can plausibly move +20%
   despite its size. This is visibility, not a quota — do NOT enforce a small-cap minimum in the top
   5; that's backlog #28's call once data confirms it's needed. Then screen down to the 5 best stocks
   with 20%+ upside (Tech/AI/Space/Semiconductors/Robotics first). Research each live before writing
   (use `stock-report` per pick).

   **20%+ upside gate — pinned definition (widened from 30% on 2026-08-13, see backlog #38):**
   measure against **consensus analyst price target vs. current price** (the primary, required gate).
   The single highest named-firm target is supporting color only — cite it, don't gate on it.
   Scenario-implied upside (Bull/Moon `scenarios[].pct`) is NOT a substitute for the gate — a stock
   without real analyst-target coverage doesn't clear 20%+ just because its own Bull case says so.
   *Why it moved:* at 30% the gate was selecting an empty set. A stock with a hard dated catalyst
   inside two weeks AND 30%+ consensus upside is close to a contradiction — analysts price the
   catalyst in — so runs kept surfacing candidates that had one or the other, never both (2026-08-13:
   NUVL +15% and SRRK +22% both had confirmed PDUFAs and failed; IRON +59% and MLTX +49% cleared
   upside but had no verified near-term event).

   **Catalyst window — ~6 weeks (42 days) from run date.** A candidate's primary catalyst must be
   dated within ~42 days to qualify as a near-term catalyst play. Widened from the implicit ~14 days
   on 2026-08-13 for the same reason as the gate. Two consequences you MUST respect:
   - **Date provenance still binds (backlog #37).** A 6-week window pulls in more aggregator entries,
     and those are exactly where CT.gov *estimated completion dates* masquerade as guided events.
     `catalystDate` must trace to company guidance / SEC filing / official PDUFA letter — never to a
     CT.gov completion estimate or an `AI-detected` aggregator row. State each candidate's date
     provenance in the longlist.
   - **Say it when a pick's catalyst sits outside 14 days.** The North Star still measures +30% within
     14 days of report price, so a pick with a catalyst 4–6 weeks out cannot be fairly scored by it —
     that window closes before the event. Note this in the screening output for any such pick so the
     backtest miss is read as a measurement-horizon artifact, not a bad pick. (Proper fix — a
     catalyst-anchored measurement alongside the 14d series — is backlog #38.)
2. Save a JSON report per pick to `web/data/reports/`.
3. Log runners-up to `web/data/near-misses.json` (counterfactual) — same shape as existing entries
   (`date`, `ticker`, `reason`, `priceAtScreen`, `topAnalystTarget`, `impliedUpside`) plus
   `"lane": "core"`. `impliedUpside` uses the same consensus-target-vs-price definition as the gate
   above, and must be a real number — if target data is noisy, log a best-effort estimate and say so
   in `reason`; never write `null`, it breaks the counterfactual math. Log **every** longlist
   candidate that doesn't make the top 5 — including ones cut before deep research at Step 1 — so the
   counterfactual covers candidate *generation*, not just the final cut. For those cut pre-research,
   `reason` starts with `"longlist-cut: "` followed by the one-line reason (e.g. no near-term dated
   catalyst, upside looked thin at a glance) — `topAnalystTarget`/`impliedUpside` may be a best-effort
   estimate for these, but still a real number, never `null`.
4. Validate (`node scripts/validate-reports.mjs`), `git add web/data/reports/ web/data/near-misses.json`,
   commit, push.
5. **Refresh STALE carryovers still on the visible board.** The `/catalyst` route shows the
   **top-10** (`TOP_N` in `web/app/catalyst/CatalystContent.tsx`) of ALL tickers, ranked by
   catalyst proximity — not just the 5 you screened this run. So older picks that are still near
   their catalyst stay on the board and rot: their report ages past 7 days and shows STALE
   (`ageDays >= 7` in `web/app/report/[ticker]/StalenessBanner.tsx`). A run that refreshes only
   the new 5 leaves ~half the visible board stale.
   After Step 4, compute the visible board the same way the page does — `rankReports(getAllReports())`,
   filter `reportStage(r) !== "post"`, take the top 10 — and for **every ticker in that top-10 that
   is NOT one of the 5 you just wrote AND whose latest report is >=7 days old**, re-run the single-ticker
   `/analyze` flow (`stock-report` skill: fresh research -> new `web/data/reports/<TICKER>_<today>.json`).
   Print the list of carryovers you're refreshing first (e.g. `refreshing STALE top-10 carryovers:
   CAPR OKLO POET KTOS`). Validate + commit + push these together with (or right after) the 5.
   Goal: the entire visible top-10 is fresh, not just the new picks. If none is stale, print
   `top-10 carryovers all fresh - none to refresh`.
6. Report the actual branch pushed. If it's not `main`, say "pushed to `<branch>` — merge to main
   to deploy", never "Vercel deploying". Visible at `/catalyst` once on `main`. End with: "market-timing
   not refreshed in this run — run `/macro` to update."
