---
description: Analyze ONE specific stock — full single-stock catalyst report, save JSON + push
argument-hint: <TICKER>
---
Run the `/analyze` workflow from CLAUDE.md for ticker: **$ARGUMENTS**

This is SINGLE-TICKER only — do NOT screen or build a dashboard.
1. Load the `xvary-stock-report` skill.
2. Follow "CRITICAL: After every /analyze — Save JSON + Git Push" in CLAUDE.md: research live (price, catalyst, analyst targets, comparable cases) BEFORE writing, then save JSON to `web/data/reports/<TICKER>_<YYYYMMDD>.json`, validate, commit, push.
