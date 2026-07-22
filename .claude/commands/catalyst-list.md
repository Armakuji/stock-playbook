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
1. **First, assemble a candidate longlist (≥12 tickers spanning ≥4 distinct `catalystType`s)** before
   any deep research — source broadly: upcoming earnings calendars, FDA/PDUFA calendars, product
   launch schedules, 52-week-low bounces with a dated event — not just "famous AI names" pulled from
   memory (salience bias is exactly what produces repeat mega-cap picks whose real +30%/14d odds are
   near-zero by market-cap physics alone — see backlog #34). One line per candidate:
   `TICKER · cap tier (mega ≥$200B / large $10–200B / smid <$10B) · catalyst + approx date · why it
   might clear +30%`. **Print the longlist in chat before narrowing to 5** — a step with no visible
   output is a step that silently gets skipped. **Self-check:** if the top 5 you cut down to ends up
   all mega-cap, state in one sentence why each one can plausibly move +30% in 14 days despite its
   size. This is visibility, not a quota — do NOT enforce a small-cap minimum in the top 5; that's
   backlog #28's call once data confirms it's needed. Then screen down to the 5 best stocks with
   30%+ upside (Tech/AI/Space/Semiconductors/Robotics first). Research each live before writing (use
   `stock-report` per pick).
   **30%+ upside gate — pinned definition:** measure against **consensus analyst price target vs.
   current price** (the primary, required gate). The single highest named-firm target is supporting
   color only — cite it, don't gate on it. Scenario-implied upside (Bull/Moon `scenarios[].pct`) is
   NOT a substitute for the gate — a stock without real analyst-target coverage doesn't clear 30%+
   just because its own Bull case says so.
2. Save a JSON report per pick to `web/data/reports/`.
3. Log runners-up to `web/data/near-misses.json` (counterfactual) — same shape as existing entries
   (`date`, `ticker`, `reason`, `priceAtScreen`, `topAnalystTarget`, `impliedUpside`) plus
   `"lane": "core"`. `impliedUpside` uses the same consensus-target-vs-price definition as the gate
   above, and must be a real number — if target data is noisy, log a best-effort estimate and say so
   in `reason`; never write `null`, it breaks the counterfactual math. Log **every** longlist
   candidate that doesn't make the top 5 — including ones cut before deep research at Step 1 — so the
   counterfactual covers candidate *generation*, not just the final cut. For those cut pre-research,
   `reason` starts with `"longlist-cut: "` followed by the one-line reason (e.g. no near-term dated
   catalyst, upside looked thin at a glance) — `topAnalystTarget`/`impliedUpside` may be a best-effort
   estimate for these, but still a real number, never `null`.
4. Validate (`node scripts/validate-reports.mjs`), `git add web/data/reports/ web/data/near-misses.json`,
   commit, push.
5. **Refresh STALE carryovers still on the visible board.** The `/catalyst` route shows the
   **top-10** (`TOP_N` in `web/app/catalyst/CatalystContent.tsx`) of ALL tickers, ranked by
   catalyst proximity — not just the 5 you screened this run. So older picks that are still near
   their catalyst stay on the board and rot: their report ages past 7 days and shows STALE
   (`ageDays >= 7` in `web/app/report/[ticker]/StalenessBanner.tsx`). A run that refreshes only
   the new 5 leaves ~half the visible board stale.
   After Step 4, compute the visible board the same way the page does — `rankReports(getAllReports())`,
   filter `reportStage(r) !== "post"`, take the top 10 — and for **every ticker in that top-10 that
   is NOT one of the 5 you just wrote AND whose latest report is >=7 days old**, re-run the single-ticker
   `/analyze` flow (`stock-report` skill: fresh research -> new `web/data/reports/<TICKER>_<today>.json`).
   Print the list of carryovers you're refreshing first (e.g. `refreshing STALE top-10 carryovers:
   CAPR OKLO POET KTOS`). Validate + commit + push these together with (or right after) the 5.
   Goal: the entire visible top-10 is fresh, not just the new picks. If none is stale, print
   `top-10 carryovers all fresh - none to refresh`.
6. Report the actual branch pushed. If it's not `main`, say "pushed to `<branch>` — merge to main
   to deploy", never "Vercel deploying". Visible at `/catalyst` once on `main`. End with: "market-timing
   not refreshed in this run — run `/macro` to update."
