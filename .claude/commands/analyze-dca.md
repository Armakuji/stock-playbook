---
description: Single quality-core DCA report → web/data/dca/ → /dca
argument-hint: <TICKER>
---
Run `/analyze-dca` for **$ARGUMENTS**: load the `dca-report` skill and follow it. Save JSON to `web/data/dca/<TICKER>_<YYYYMMDD>.json` with DCA fields (valuationBand, qualityScore, dcaPlan, thesisBreak; assetType "stock"), validate, commit, push. Visible at `/dca`.
