---
description: Find the 5 best ETFs AND 5 best quality-core stocks for DCA → /dca
---
Run `/dca-list`: load `dca-report` and follow it (including the "Fund (ETF) mode" section).
Produce TWO baskets saved to `web/data/dca/`:
- 5 best US/global ETFs (`assetType:"fund"` + `fundInfo`) — the กองทุน tab.
- 5 best quality-core stocks (`assetType:"stock"`) — the หุ้น tab.
Score with the DCA model (quality+valuation), validate, commit, push once. No market-timing step. Visible at `/dca` (2 tabs) once on `main` — report the actual branch pushed; if it's not `main`, say "pushed to `<branch>` — merge to main to deploy", never "Vercel deploying".
