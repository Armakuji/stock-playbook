---
description: Generate the catalyst dashboard — screen 5 best 30%+ catalyst plays
---
Run the `/catalyst-list` workflow from CLAUDE.md (the catalyst dashboard; formerly /dashboard).

0. Read `web/data/skill-feedback.json` if it exists (skip if missing) — use as an **advisory
   prior**, two tiers:
   - **Tier 1 — `n < 5`:** context only. Mention it, never a reason to include/exclude/re-rank a pick.
   - **Tier 2 — `n ≥ 5`: MUST be applied.** If a `core.byType[]` bucket's `hitRate` is clearly
     below `core.overall.hitRate`, that catalystType needs visibly higher upside/conviction to
     make top 5 — state in your screening reasoning which type and its hitRate vs. overall. If no
     `n ≥ 5` bucket diverges, say "prior read, no bucket met the n≥5 + divergence bar."
   - **Regime caveat (both tiers):** always read `hitRate` next to `avgBenchmarkPct`/`regimeNote` —
     a low hitRate during a window where `regimeNote` shows SPY broadly down is "unproven in a bad
     regime," not "this type doesn't work." Check the actual `regimeNote` text every run, don't
     assume the story repeats (SPY won't catch a sector-only selloff — a known gap in this rough
     v1 signal, e.g. `earnings_beat` once read 0/12 hitRate with a *calm* regimeNote, meaning the
     miss was NOT regime-excused that time).
   - Reference `medianMAE` when sizing/stopping.
   **Print this block in chat before screening — a step with no visible output is a step that
   silently gets skipped:**
   ```
   📊 Feedback prior (skill-feedback.json, generated <date>):
     core: n=<n> complete=<k> · hitRate <x%|no data yet> · <one-line takeaway>
     regime: SPY median <x>% over windows (n=<n>)
     tier-2: <fired for <type> (hitRate X% vs overall Y%) | not fired — no bucket met n≥5 + divergence bar>
     guardrail: n<5 = context only · n≥5 = MUST apply (see tier-2 line)
   ```
   If the file doesn't exist, print `📊 Feedback prior: skill-feedback.json not found — skipping` instead.
1. Screen for the 5 best stocks with 30%+ upside (Tech/AI/Space/Semiconductors/Robotics first). Research each live before writing (use `stock-report` per pick).
2. Save a JSON report per pick to `web/data/reports/`.
3. Log runners-up to `web/data/near-misses.json` (counterfactual) — same shape as existing entries
   (`date`, `ticker`, `reason`, `priceAtScreen`, `topAnalystTarget`, `impliedUpside`) plus
   `"lane": "core"`. `impliedUpside` must be a real number — if target data is noisy, log a
   best-effort estimate and say so in `reason`; never write `null`, it breaks the counterfactual math.
4. Validate (`node scripts/validate-reports.mjs`), `git add web/data/reports/ web/data/near-misses.json`,
   commit, push.
5. Report the actual branch pushed. If it's not `main`, say "pushed to `<branch>` — merge to main
   to deploy", never "Vercel deploying". Visible at `/catalyst` once on `main`. End with: "market-timing
   not refreshed in this run — run `/macro` to update."
