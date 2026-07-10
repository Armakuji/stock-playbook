---
description: Single moonshot (300%+ speculative) report → web/data/speculative/ → /turbo
argument-hint: <TICKER>
---
Run `/analyze-turbo` for **$ARGUMENTS**: load the `turbo-report` skill and follow it. Save JSON to `web/data/speculative/<TICKER>_<YYYYMMDD>.json` (NOT reports/), validate, commit, push. Visible at `/turbo` once on `main` — report the actual branch pushed; if it's not `main`, say "pushed to `<branch>` — merge to main to deploy", never "Vercel deploying".
