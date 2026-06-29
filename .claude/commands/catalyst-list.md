---
description: Generate the catalyst dashboard — screen 5 best 30%+ catalyst plays + market timing
---
Run the `/catalyst-list` workflow from CLAUDE.md (the catalyst dashboard; formerly /dashboard).

1. Screen for the 5 best stocks with 30%+ upside (Tech/AI/Space/Semiconductors/Robotics first). Research each live before writing (use `xvary-stock-report` per pick).
2. Save a JSON report per pick to `web/data/reports/`.
3. Log runners-up to `web/data/near-misses.json` (counterfactual).
4. Generate market timing → save `web/data/market-timing.json` (see the "After every /catalyst-list — Save market-timing.json" section in CLAUDE.md for the exact schema).
5. Validate (`node scripts/validate-reports.mjs`), `git add web/data/reports/ web/data/market-timing.json web/data/near-misses.json`, commit, push. Visible at `/catalyst`.
