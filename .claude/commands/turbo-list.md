---
description: Find the 5 best moonshot plays (≥200–300% bull case) → /turbo
---
Run `/turbo-list`: load `turbo-report` and use its "Step 0" + "List mode" sections.

0. Read `web/data/skill-feedback.json` if it exists (skip if missing) — use `turbo.overall`
   hitRate/medianMAE as an advisory prior, two tiers (ranking is upside-first per the current spec
   — base-case % primary, moon % tiebreaker, per Step 1 below; survival-first ranking is backlog
   #11 and not yet implemented. Both tiers affect sizing/conviction language only, never rank order):
   - **Tier 1 — `n < 5`:** context only. Mention it, never a reason to include/exclude/re-rank.
   - **Tier 2 — `n ≥ 5`: MUST be applied.** Turbo has no per-type breakdown, so this applies at the
     whole-lane level: if `turbo.overall.n ≥ 5` and `hitRate` is low, that MUST visibly tighten
     sizing/conviction guidance across all picks this run (smaller `spotSizing.pct`, tighter stop
     language) — say so explicitly when it fires. If `n < 5`, say "prior read, n<5 — context only."
   - **Regime caveat (both tiers):** read `hitRate` next to `avgBenchmarkPct`/`regimeNote` — a low
     hitRate during a window where `regimeNote` shows SPY broadly down is "unproven in a bad
     regime," not "turbo doesn't work." Check the actual `regimeNote` text every run, don't assume
     it (SPY won't catch a sector-only selloff — a known gap in this rough v1 signal).
   **Print this block in chat before screening — a step with no visible output is a step that
   silently gets skipped:**
   ```
   📊 Feedback prior (skill-feedback.json, generated <date>):
     turbo: n=<n> complete=<k> · hitRate <x%|no data yet> · <one-line takeaway>
     regime: SPY median <x>% over windows (n=<n>)
     tier-2: <fired — sizing tightened this run | not fired — n<5, context only>
     guardrail: n<5 = context only · n≥5 = MUST apply (see tier-2 line)
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
4. Report the actual branch pushed. If it's not `main`, say "pushed to `<branch>` — merge to main
   to deploy", never "Vercel deploying". Visible at `/turbo` once on `main`.

No market-timing step — that's `/macro`-only.
