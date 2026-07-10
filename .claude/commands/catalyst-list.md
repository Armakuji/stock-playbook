---
description: Generate the catalyst dashboard — screen 5 best 30%+ catalyst plays
---
Run the `/catalyst-list` workflow from CLAUDE.md (the catalyst dashboard; formerly /dashboard).

0. Read `web/data/skill-feedback.json` if it exists (skip if missing) — use as an **advisory
   prior**: catalystTypes with a low measured `core.byType[].hitRate` need higher upside/conviction
   to make top 5; strong-hitRate types get the benefit of the doubt; reference `medianMAE` when
   sizing/stopping. **⚠️ HARD GUARDRAIL: `n < 5` for any bucket = mention as context only, NEVER a
   reason to include/exclude/re-rank a pick. No auto-weighting.**
   **Print this block in chat before screening — a step with no visible output is a step that
   silently gets skipped:**
   ```
   📊 Feedback prior (skill-feedback.json, generated <date>):
     core: n=<n> complete=<k> · hitRate <x%|no data yet> · <one-line takeaway>
     guardrail: buckets with n<5 = context only
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
