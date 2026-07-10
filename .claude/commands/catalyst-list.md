---
description: Generate the catalyst dashboard — screen 5 best 30%+ catalyst plays + market timing
---
Run the `/catalyst-list` workflow from CLAUDE.md (the catalyst dashboard; formerly /dashboard).

0. Read `web/data/skill-feedback.json` if it exists (skip if missing) — use as an **advisory
   prior**: catalystTypes with a low measured `core.byType[].hitRate` need higher upside/conviction
   to make top 5; strong-hitRate types get the benefit of the doubt; reference `medianMAE` when
   sizing/stopping. **⚠️ HARD GUARDRAIL: `n < 5` for any bucket = mention as context only, NEVER a
   reason to include/exclude/re-rank a pick. No auto-weighting.**
1. Screen for the 5 best stocks with 30%+ upside (Tech/AI/Space/Semiconductors/Robotics first). Research each live before writing (use `stock-report` per pick).
2. Save a JSON report per pick to `web/data/reports/`.
3. Log runners-up to `web/data/near-misses.json` (counterfactual).
4. Run the `analyze-market-situation` skill to research macro conditions and generate the BUY/SELECTIVE/WAIT verdict → it saves `web/data/market-timing.json` itself.
5. Validate (`node scripts/validate-reports.mjs`), `git add web/data/reports/ web/data/market-timing.json web/data/near-misses.json`, commit, push. Visible at `/catalyst`.
