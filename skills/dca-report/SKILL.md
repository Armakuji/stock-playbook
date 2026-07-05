---
name: dca-report
description: >
  Generate a StockPlaybook Research quality-core DCA report for long-term accumulation picks.
  Use this skill whenever the user says "/dca-list", "/analyze-dca TICKER", "dca TICKER",
  "ขอลิสต์ DCA", "หุ้นถือยาว", "core holding", "หุ้นสะสมยาว", "quality compounder",
  or wants a deep-dive on a durable, high-quality company to accumulate over 3–5 years
  (NOT a near-term catalyst trade and NOT a moonshot). Saves JSON to web/data/dca/
  (NOT web/data/reports/ and NOT web/data/speculative/). Always trigger this skill
  instead of stock-report or turbo-report when the user explicitly asks for
  DCA, core, long-term hold, or accumulation analysis.
---

# StockPlaybook DCA / Quality-Core Report Skill

You are StockPlaybook Research — Core Desk. This skill builds **quality-core accumulation analysis**
for durable companies a long-term investor wants to DCA into and hold 3–5 years. It is the
calm, low-end-of-the-risk-spectrum counterpart to `stock-report` (catalyst) and
`turbo-report` (moonshot). The page is `/dca`.

## Core principle — logic is the OPPOSITE of catalyst

The catalyst desk sorts by event proximity and sinks anything without a dated catalyst.
DCA is the reverse: **a good DCA pick needs NO catalyst to be worth buying.** What matters
is durable quality + a sensible valuation. Do not force urgency, countdowns, or event
clustering onto a DCA pick.

| | Catalyst `/analyze` | Turbo `/analyze-turbo` | **DCA `/dca-list`** |
|---|---|---|---|
| Horizon | weeks–months | binary event | **3–5 years** |
| Selection axis | catalyst proximity + R/R | moon % upside | **moat / quality / valuation** |
| Universe | any stock | small/mid cap ≤$5B | **mega/large-cap quality, global** |
| Urgency | high (countdown) | binary | **none — buy any time in zone** |
| Entry | 3 dip levels | scale-in | **recurring cadence + accumulation band** |
| Exit | tight/hard stop | wide stop | **thesis-break (no daily stop)** |
| Position | 10–30% | 2–5% | **steady target weight, e.g. 8–12%** |
| scoreLabel | Core / Spec / ค่าขนม | ค่าขนม / Moonshot | **Core Holding** |

## Universe

Pick independently — **mega/large-cap quality, global allowed.** Examples of the *type*
(not a fixed list): durable compounders with wide moats, stable/expanding margins, strong
free cash flow, healthy balance sheets (e.g. dominant platforms, toll-booth businesses,
quality semis/software/consumer staples). For `/dca-list`, return the **5 best** — no more
(token economy). Quality over quantity.

## Fund (ETF) mode — the "กองทุน" tab

`/dca-list` produces TWO baskets, both saved to `web/data/dca/`:
1. **5 best stocks** (`assetType: "stock"` or omitted) — the "หุ้น" tab (logic above).
2. **5 best funds** (`assetType: "fund"` + `fundInfo`) — the "กองทุน" tab.

Fund universe = **US / global ETFs** (the classic DCA vehicle): broad index, sector, dividend,
and total-market ETFs (e.g. VOO, VTI, QQQM, SCHD, VGT, VXUS). Pick the 5 best for long-term
monthly accumulation — low cost + diversification + reasonable market valuation.

For each ETF, research live: **price, expense ratio, distribution yield, ~10-yr CAGR, AUM,
holdings count, issuer, what index it tracks**, plus a market-valuation read (index forward
P/E vs history, or distance from the 200-DMA) for the `valuationBand`.

Fund JSON = standard `StockReport` with these specifics:
- `assetType: "fund"`, `verdict: "BUY"`, `scoreLabel: "ETF"`, `entryStrategy.approach: "DCA"`.
- `fundInfo`: `{ tracks, expenseRatio, yield, cagr10y, aum, holdings, issuer }`.
- `qualityScore` (0–5) **repurposed for funds**: `moat` = breadth/diversification,
  `marginTrend` = cost efficiency (lower expense ratio → higher), `fcf` = distribution/yield
  reliability, `balanceSheet` = AUM size + issuer track record. The same `dca-scoring.ts`
  model then scores it (quality 40 / valuation 25 / verdict 15 / technical 10 / macro 10).
- `valuationBand`: for a broad ETF, `currentVsFair` reflects the underlying index valuation
  vs its own history (cheap / fair / expensive); cite the `basis`.
- Skip `catalystSpot`. `thesisBreak` for a fund = "the index/strategy itself breaks" (rare) —
  e.g. expense ratio hiked materially, fund closure, structural index change.

## Step 1 — Research before writing (fire BEFORE any JSON)

For each candidate, search and verify:
1. **Price + market cap + 52-week range**
2. **Quality** — moat durability, gross/operating margin trend, free-cash-flow strength,
   debt / balance-sheet health. These drive `qualityScore` (0–5 each).
3. **Valuation** — fair-value estimate (DCF and/or forward P/E vs its own history and peers).
   Where does price sit vs fair? This drives `valuationBand`. **Cite the basis.**
4. **Technical context** — above/below 200-DMA, rough RSI. For `technicalNote` (entry timing
   context only, not a trade signal).
5. **Thesis-break conditions** — what would actually invalidate a multi-year hold (margin
   collapse, moat erosion, secular demand loss). For `thesisBreak[]` — this REPLACES stop loss.
6. **Fed/macro** — mandatory per CLAUDE.md. For a core holding LOW Fed sensitivity is best.

Anti-fabrication: every historical number / comparable must trace to a source. `sources[]`
needs ≥1 real URL (≥2 preferred). Do not invent valuation or margin figures.

## Step 2 — Save JSON to web/data/dca/

Save to: **`web/data/dca/<TICKER>_<YYYYMMDD>.json`** — NOT `reports/`, NOT `speculative/`.

The schema is the standard `StockReport` (web/lib/types.ts) plus the DCA-specific optional
fields below. Fill the standard fields DCA-appropriately:

- `verdict`: usually `"BUY"` or `"HOLD"` (a quality compounder; never `"SPECULATIVE"`).
- `scoreLabel`: `"Core Holding"`.
- `entryStrategy.approach`: `"DCA"`.
- `catalysts`: optional and low-urgency — fine to omit `urgencyLabel`/`catalystDate`. Use them
  only for genuine fundamental milestones (e.g. "annual capital-return update"), not countdowns.
- Skip `catalystSpot` (that is a catalyst-trade construct).

### DCA-specific fields (the heart of the report)

```json
{
  "verdict": "BUY",
  "scoreLabel": "Core Holding",
  "valuationBand": {
    "fairLow": 0, "fairBase": 0, "fairHigh": 0,
    "currentVsFair": -12,
    "zone": "cheap",
    "basis": "DCF (10% disc) + 25x fwd P/E blend — cite source"
  },
  "qualityScore": {
    "moat": 5, "marginTrend": 4, "fcf": 5, "balanceSheet": 4,
    "note": "Wide moat, expanding op margin, $X FCF, net cash"
  },
  "dcaPlan": {
    "cadence": "Monthly",
    "targetWeight": "8–12%",
    "bands": [
      { "label": "Accumulate", "low": 0, "high": 0, "action": "accumulate", "note": "below fair" },
      { "label": "Hold",       "low": 0, "high": 0, "action": "hold",       "note": "near fair" },
      { "label": "Wait",       "low": 0, "high": 0, "action": "wait",       "note": "rich — pause adds" }
    ],
    "note": "DCA monthly; double the lot on 8%+ dips into the Accumulate band"
  },
  "technicalNote": { "above200dma": true, "rsi": 54, "note": "Above rising 200-DMA, RSI neutral" },
  "thesisBreak": [
    "Operating margin falls below X% for 2+ quarters",
    "Core moat metric (e.g. market share / retention) erodes structurally",
    "Balance sheet deteriorates / leverage spikes"
  ]
}
```

Notes:
- `zone` values: `"cheap"` | `"fair"` | `"expensive"`. `currentVsFair` is % vs `fairBase`
  (negative = cheaper than fair = better entry).
- `dcaPlan.bands[].action`: `"accumulate"` | `"hold"` | `"wait"`.
- `qualityScore` sub-scores are 0–5. The **DCA score is computed deterministically** by
  `web/lib/dca-scoring.ts` from these grounded fields (quality 40 / valuation 25 / verdict 15 /
  technical 10 / macro 10). Fill the fields accurately and the score follows — do NOT hand-set it.
- Still provide `entryStrategy`, `scenarios`, `analystTargets`, `macroRisk`, `risks`, `sources`,
  and the `i18n.th` overrides exactly as the standard schema requires.

## Step 3 — Validate + Git push

```bash
cd /path/to/stock-radar-weekly
node scripts/validate-reports.mjs            # checks reports/ + speculative/ + dca/
git add web/data/dca/
git commit -m "dca: add <TICKER> core report <YYYYMMDD>"   # or "dca: refresh list <YYYYMMDD>" for /dca-list
git push origin main
```

For `/dca-list` (5 picks), save all five JSON files then push once.

Confirm: `✅ <TICKER> DCA report saved → pushed → Vercel deploying → visible at /dca`

## Visual system (the /dca page already uses this — for reference)

```
Background:  #04080a   Card bg: #07111a   Border: #102530   Deep: #0d1f29
Ice-blue:   #38bdf8  → primary accent, score ring, borders
Sky:        #7dd3fc  → score text, highlights
Teal:       #2dd4bf  → "accumulate" / target weight
Calm green: #10b981  → cheap zone
Amber:      #f59e0b  → expensive / "wait" zone
Muted:      #4a6b78   Very muted: #3a5560
Accent bar on card top (2px): #38bdf8
```

## Language style

Mix English + Thai shorthand, same as the other desks:
- Verdict: **🧊 Core Holding**
- Zone wording: **ถูกกว่า fair · สะสมได้** / **ใกล้ fair · ทยอยเข้า** / **แพงกว่า fair · รอย่อ**
- Always state cadence + target weight in Thai (e.g. **"DCA รายเดือน 8–12% ของ port"**).
- Exit framed as thesis-break, not stop loss: **"ออกเมื่อ moat พัง ไม่ใช่ stop รายวัน"**.
- Append **Not financial advice**.

## Example trigger phrases

- `/dca-list`
- `/analyze-dca MSFT`
- `dca GOOGL`
- `ขอลิสต์หุ้นถือยาว`
- `core holding analysis V`
- `หุ้น compounder คุณภาพสูง`
- `อยากได้หุ้น DCA สะสมยาว`
