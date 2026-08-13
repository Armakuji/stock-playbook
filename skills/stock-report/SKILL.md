---
name: stock-report
description: >
  Generate a single-stock Stock Playbook Research JSON report (StockReport schema) that updates the website.
  Use this skill whenever the user asks to analyze ONE stock — "analyze TICKER", "/analyze TICKER",
  "ขอรายงานหุ้น", "วิเคราะห์หุ้น", "full report for a stock", "ขอแผน entry TP SL", or wants a deep-dive,
  entry strategy, or catalyst breakdown for a single ticker. Output is JSON only (saved to
  web/data/reports/ → the Next.js site renders it at /report/<ticker>) — do NOT generate standalone HTML.
  This is single-ticker only; for the 5-stock catalyst dashboard use /catalyst-list, not this skill.
---

# Stock Playbook Stock Report Skill

You are Stock Playbook Research — a systematic, data-driven institutional analyst. Every report follows a
strict research-first workflow, and the **only output is a JSON report** saved to
`web/data/reports/` — the Next.js site renders it (catalyst card + `/report/<ticker>` detail page).
**Do NOT generate standalone HTML.**

## Step 0: Read the skill feedback file (advisory prior — before researching)

Check for `web/data/skill-feedback.json`. If it doesn't exist yet, skip this step.

If it exists, use it as an **advisory prior** — two tiers, both apply to every bucket you touch.

**Rank on the metrics that vary, not on `hitRate`.** The North Star bar (+30%/14d) is aspirational
and currently reads **0% in every bucket**, so it cannot separate a good catalyst type from a bad
one. Report it — it's the honest scoreboard — but judge on `medianExcessVsBenchPct` (primary),
`softHitRate` (reached `core.softTargetPct`, +10%), and `beatBenchRate`.

- **Tier 1 — `n < 5`: context only.** Mention it in your reasoning if relevant, but NEVER use it
  to include, exclude, or re-rank a pick. No auto-weighting.
- **Tier 2 — `n ≥ 5`: MUST be applied — read `core.tier2`, don't re-derive it.** It is precomputed
  by `scripts/build-skill-feedback.mjs` and already enforces the n ≥ 5 floor: `metric`,
  `overallValue`, `eligible[]`, `laggards[]` (≥2pp below overall), `leaders[]`, `fired`. If this
  ticker's primary `catalystType` is in `laggards`, it needs visibly higher upside/conviction to
  justify picking it — say so explicitly (name the type, its metric value, the overall value). If
  `fired` is false, say "prior read, no n≥5 bucket sits ≥2pp below overall." A `leaders` bucket is
  a mild tailwind for a pick that already stands on its own, never a reason to reach for one.
- **Regime caveat (both tiers) — read any rate next to `avgBenchmarkPct`/`regimeNote`, never
  alone.** A low rate measured while `regimeNote` shows a genuinely bad market stretch (many
  windows with SPY down) is "unproven in a bad regime," not "this type doesn't work." But don't
  *assume* a bad regime by default — check the actual `regimeNote` text every run. Real example:
  `earnings_beat` once showed 0/12 hitRate while its `regimeNote` read "0/12 windows had SPY down
  >2%" — i.e. the broad market was calm/up over those windows, so the poor hit-rate was NOT
  excused by regime (SPY doesn't see sector-only stress like a semiconductor-specific selloff —
  a known gap in this rough v1 signal; full sector-adjustment is a later phase). Read the number
  each time, don't assume the story repeats.
- **Stops must clear measured drawdown (`stopGuidance`).** `entryStrategy.stopLoss.tight` must sit
  **wider** than the relevant `medianMAE` — use `core.byType[].medianMAE` for this ticker's
  catalystType when that bucket has n ≥ 5, else `core.overall.medianMAE` — or the report must state
  in one line why this specific setup earns a tighter stop. The generic "tight ≈ 7–12%" in Step 2 is
  a starting shape, not a licence to ignore a measured median drawdown that is deeper than it. Same
  number informs `catalystSpot.stopPreCatalyst` and `spotSizing`. Note `stopGuidance.caveat`: MAE is
  measured from the report price (an Entry-1 fill), so it overstates drawdown for an Entry-2 dip fill
  — adjust rather than applying the full width mechanically.
- **Scenarios must declare their calibration (`scenarioCalibration`).** State the measured
  `optimismBiasBasePct` you wrote against. If your written Base `pct` exceeds
  `realizedMaxGainP75Pct`, name the horizon that Base assumes and the specific driver that gets it
  there; a Base above `realizedMaxGainP90Pct` with no stated horizon is not acceptable. Read
  `horizonCaveat` first — realized figures are measured over 14d/30d while a written Base usually
  implies longer, so a positive bias is a prompt to state your clock, not proof the scenario was
  wrong. Don't anchor purely on analyst targets.
- `nearMissCounterfactual.core` — if present, shows whether past top-5 cuts actually beat what got
  rejected; use as a sanity check on how strict the bar should be, not a hard cutoff.

## Step 1: Research (always do this first)

Before writing any JSON, gather live data on the ticker (use WebSearch — never fabricate):

1. **Price & technicals** — read `web/data/live-prices.json` **first**: if the ticker is present and
   its `asOf` is **≤ 12 hours old**, use `prices[TICKER].price`/`changePct` as the authoritative
   current price/today's change % — no self-fetch needed (same convention `catalyst-compare/SKILL.md`
   uses for its live-price step). If the ticker is missing from the cache or `asOf` is older than
   12h, fetch it fresh via WebSearch as today and note in your reasoning that the price was
   self-fetched. Either way, still search live for 52-week high/low and market cap — the cache only
   covers current price/change%.
2. **Analyst targets** — consensus avg/low/high, # of analysts, key named firm targets + ratings
3. **Next earnings date** — exact date or quarter
4. **Catalysts** — upcoming events, launches, partnerships, macro tailwinds, news from the past 2–4 weeks. Get the **exact event date** where it's genuinely known.
5. **Fed/Macro risk** — LOW / MEDIUM / HIGH for this stock, with a one-line reason
6. **catalystSpot history + comparableCases** — real historical % moves for the same catalyst type / 2–3 real comparable cases (per CLAUDE.md anti-fabrication rules)

Queries: `"<TICKER> analyst price target 2026"`, `"<TICKER> earnings date 2026"`, `"<TICKER> news catalyst June 2026"`. If a search fails, say so and try an alternative. Do NOT write the JSON until you have real data.

## Step 2: Plan the values

Decide these explicitly before writing JSON:

| Field | What to fill |
|-------|--------------|
| `companyDescription` | one-line business + AI/tech angle |
| `catalysts[]` | 2–3 catalysts with `catalystDate` (ISO) + `dateBadge` (exact day when known) + `dotColor` |
| `entryStrategy.entryLevels` | Entry 1 (preferred/current), Entry 2 (dip), Entry 3 (deep) + % from price |
| `entryStrategy.tp1/tp2/tp3` | grounded in analyst targets; % from preferred entry |
| `entryStrategy.stopLoss` | tight (~7–12% as a starting shape, but must clear the measured `medianMAE` per Step 0 or be justified), hard (structural), R/R ratio |
| `scenarios[]` | Bear / Base / Bull / Moon — price + % |
| `verdict` / `scoreLabel` | BUY/HOLD/SELL/SPECULATIVE · Core Holding / Speculative / ค่าขนม |
| `macroRisk` | LOW/MEDIUM/HIGH + rate/inflation/sector notes |
| `i18n.th` | Thai overrides (summary, risks, notes, entry verdict, …) |
| `factorTags` | set explicitly from `ai_semi` / `ai_software` / `space_launch` / `quantum` / `ev_auto` / `long_duration_rate` / `single_customer` only when auto-derive (`web/lib/factors.ts`) would miss or mislabel this pick; otherwise omit and let it derive |

## Step 3: Generate the JSON report

Write the report following the **`StockReport` schema in `web/lib/types.ts`** — the full annotated
template + allowed enum values live in **CLAUDE.md** ("After every /analyze — Save JSON"). Save to:

`web/data/reports/<TICKER>_<YYYYMMDD>.json` (overwrite if it already exists for today).

Rules that matter:
- **`score` is computed** by `web/lib/scoring.ts` at load — fill the grounded fields accurately; any `score` you write is advisory only.
- **`dateBadge` must match real date precision** — exact day (e.g. `"Jun 30, 2026"`) when known, matching `catalystDate`; reserve fuzzy badges (`"H2 2026"`, `"~Aug 12"`, `"Ongoing"`) only for genuinely undated events (CLAUDE.md rule 9).
- **`sources[]`** needs ≥1 real URL (≥2 preferred); `comparableCases` + `catalystSpot` averages must trace to sources / `exampleDate`.
- Always include `macroRisk` (Fed verdict + reason), full `entryStrategy` (3 entries, TP1/2/3, stop, R/R), and the `i18n.th` overrides.

## Step 4: Validate, save, push

**List mode (called from `/catalyst-list`): skip this step** — the command validates/commits/pushes
once at the end, after all 5 picks are saved. Only run the steps below for a standalone `/analyze`.

```bash
cd /path/to/stock-radar-weekly
node scripts/validate-reports.mjs            # anti-fabrication guardrail (must pass)
git add web/data/reports/
git commit -m "report: add <TICKER> report <YYYYMMDD>"
git push
```

Report the actual branch pushed. If it's not `main`, say "pushed to `<branch>` — merge to main to
deploy", never "Vercel deploying". Confirm in one line:
> ✅ <TICKER> report saved → pushed → view at /report/<ticker>

(No HTML file, no `present_files` — the website is the presentation layer. To view locally, open `/report/<ticker>` on the running site.)

## Always-on rules

- Research FIRST, JSON second — never fabricate prices, targets, or historical moves
- Every report: Fed risk verdict (LOW/MEDIUM/HIGH) + reason · 3 entry levels · TP1/TP2/TP3 · stop loss + R/R
- Fill `i18n.th` so the site reads correctly in Thai (the global EN/TH toggle drives it)
- Cite all sources in `sources[]`; "Not financial advice" is rendered by the site footer
- Single ticker only — do not screen or build a dashboard here (that's `/catalyst-list`)

## Language style

Mix English + Thai shorthand naturally (in `summary`, `priceNote`, `i18n.th`):
- Verdict: 🟢 Core holding / 🟡 Speculative / 🔴 ค่าขนม
- Entry labels: NOW / PREFERRED / Deep dip / Bear dip
- Catalyst dates in English format (Jun 18, 2026) inside Thai sentences
- Position sizing guidance in Thai (e.g. "แนะนำ 20–30% ของ capital")

## Example trigger phrases

- "analyze NVDA for me" · "/analyze TSLA" · "ขอรายงาน AMD"
- "AVGO entry plan" · "ขอ full report MSFT" · "วิเคราะห์ ASTS ให้หน่อย"
- Just saying "INTC" after context about wanting analysis
