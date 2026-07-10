---
description: Find the 5 best moonshot plays (≥200–300% bull case) → /turbo
---
Run `/turbo-list`: load `turbo-report` and use its "Step 0" + "List mode" sections.

0. Read `web/data/skill-feedback.json` if it exists (skip if missing) — use `turbo.overall`
   hitRate/medianMAE as an advisory prior for sizing/stop notes only; ranking stays survival-first
   (backlog #11), unchanged by feedback. **⚠️ HARD GUARDRAIL: `n < 5` for any bucket = mention as
   context only, NEVER a reason to include/exclude/re-rank a pick. No auto-weighting.**
   **Print this block in chat before screening — a step with no visible output is a step that
   silently gets skipped:**
   ```
   📊 Feedback prior (skill-feedback.json, generated <date>):
     turbo: n=<n> complete=<k> · hitRate <x%|no data yet> · <one-line takeaway>
     guardrail: buckets with n<5 = context only
   ```
   If the file doesn't exist, print `📊 Feedback prior: skill-feedback.json not found — skipping` instead.
1. Screen for the 5 best small/mid-cap moonshots (≥200–300% bull case + binary catalyst), rank by
   most possible upside (base-case % primary, moon % tiebreaker), generate a turbo report for each
   → save to `web/data/speculative/`.
2. Log runners-up (passed the moonshot screen but missed top 5) to `web/data/near-misses.json` —
   same shape as `/catalyst-list`'s near-miss entries (`date`, `ticker`, `reason`, `priceAtScreen`,
   `topAnalystTarget`, `impliedUpside`) plus `"lane": "turbo"`. `impliedUpside` must be a real
   number — if target data is noisy, log a best-effort estimate and say so in `reason`; never write
   `null`, it breaks the counterfactual math.
3. Validate, `git add web/data/speculative/ web/data/near-misses.json`, commit, push once.
4. Report the actual branch pushed. If it's not `main`, say "pushed to `<branch>` — merge to main
   to deploy", never "Vercel deploying". Visible at `/turbo` once on `main`.

No market-timing step — that's `/macro`-only.
