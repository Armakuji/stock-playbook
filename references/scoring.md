# StockPlaybook Scores (Public Definitions)

This file defines the **public** score framework used by the skill.

Important: production StockPlaybook systems use proprietary calibrations. The equations below expose the logic shape, not private threshold tables.

## Score Scale

All scores are normalized to `0-100`.

- `80-100`: Strong
- `60-79`: Constructive
- `40-59`: Mixed
- `0-39`: Weak

## Inputs

Inputs come from:

- `tools/edgar.py` (filings + fundamentals)
- `tools/market.py` (price + valuation context)

The public skill uses the latest annual and quarterly data where available.

## 1) Momentum Score

Measures forward drive in fundamentals + market behavior.

Public formula shape:

`Momentum = 100 * (w1*Growth + w2*Revision + w3*RelativeStrength + w4*OperatingLeverage)`

Component definitions (normalized to `0-1`):

- `Growth`: revenue/EPS growth persistence
- `Revision`: direction of estimate/expectation changes
- `RelativeStrength`: recent relative price performance
- `OperatingLeverage`: incremental profit conversion on growth

## 2) Stability Score

Measures durability and variance control.

Public formula shape:

`Stability = 100 * (w1*MarginStability + w2*CashFlowStability + w3*CyclicalityBuffer + w4*ExecutionConsistency)`

Components:

- `MarginStability`: volatility in gross/operating profile
- `CashFlowStability`: operating cash-flow consistency
- `CyclicalityBuffer`: sensitivity to external demand shocks
- `ExecutionConsistency`: beat/miss and guidance reliability trend

## 3) Financial Health Score

Measures solvency quality and balance-sheet resilience.

Public formula shape:

`FinancialHealth = 100 * (w1*Liquidity + w2*Leverage + w3*Coverage + w4*CashConversion)`

Components:

- `Liquidity`: cash + near-term flexibility
- `Leverage`: debt load relative to earnings power
- `Coverage`: debt service coverage strength
- `CashConversion`: earnings-to-cash realization quality

## 4) Upside Estimate Score

Measures risk-reward asymmetry vs. implied expectations.

Public formula shape:

`Upside = 100 * (w1*IntrinsicGap + w2*ScenarioAsymmetry + w3*CatalystDensity + w4*ExpectationMispricing)`

Components:

- `IntrinsicGap`: conservative value range minus current price
- `ScenarioAsymmetry`: upside/downside distribution quality
- `CatalystDensity`: number and quality of near-term unlocks
- `ExpectationMispricing`: mismatch between consensus and thesis path

## Composite View (Optional)

Some outputs use an optional composite:

`Composite = a*Momentum + b*Stability + c*FinancialHealth + d*Upside`

Weights are intentionally configurable by sector/business model in production.

## Confidence Annotation

Each score can include a confidence tag based on evidence depth:

- `High`: robust multi-source evidence, low internal contradiction
- `Medium`: adequate evidence, some assumptions open
- `Low`: sparse data or unresolved contradictions

## Kill Criteria Coupling

Scores are never final without kill criteria.

If a listed kill criterion triggers, the thesis should be re-underwritten regardless of score level.

## Deterministic Report Score (implemented)

The `score` shown on every report is computed by `web/lib/scoring.ts` (`computeScore`)
and recomputed at load time in `web/lib/reports.ts` — it is **reproducible**: same
report JSON in → same score out, no hand-tuning. Components (max 100):

| Component | Max | Basis (grounded field) |
|-----------|-----|------------------------|
| Verdict conviction | 30 | `verdict` (BUY 30 / SPECULATIVE 18 / HOLD 15 / SELL 4) |
| Analyst upside | 20 | median `analystTargets` vs `price` (+40% ⇒ full) |
| Scenario asymmetry | 15 | best/worst `scenarios.pct` ratio (3:1 ⇒ full) |
| Entry R/R | 10 | TP2 vs tight stop from entry (3:1 ⇒ full) |
| Catalyst density | 10 | count of `catalysts` |
| Macro (Fed) risk | 15 | `macroRisk.fedRisk` (LOW 15 / MED 8 / HIGH 0) |

Hover the score on a report to see the per-component breakdown.

## Not Included in Public Docs

- Production weight values (`w1..w4`, `a..d`)
- Threshold cutoffs and regime-specific overrides
- Internal fallback logic for sparse/contradictory data
