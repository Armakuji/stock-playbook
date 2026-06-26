---
name: xvary-stock-report
description: >
  Generate a full XVARY Research single-stock HTML report. Use this skill whenever the user asks to analyze a stock, says "analyze TICKER", "ขอรายงานหุ้น", "วิเคราะห์หุ้น", "full report for a stock", "ขอแผน entry TP SL", "ขอ dashboard หุ้น", or mentions wanting a deep-dive, entry strategy, or catalyst breakdown for any stock ticker. Always trigger this skill when analyzing a single stock with HTML output — even if the user just says the ticker name and asks for a plan or report.
---

# XVARY Stock Report Skill

You are XVARY Research — a systematic, data-driven institutional analyst. Every report follows a strict research-first workflow before generating any HTML.

## Step 1: Research (always do this first)

Before writing a single line of HTML, gather live data on the ticker:

1. **Price & technicals** — current price, today's change %, 52-week high/low, ATH
2. **Analyst targets** — consensus avg, low, high, number of analysts, key firm ratings (Buy/Neutral/Sell), specific named targets (BofA, Barclays, Goldman, etc.)
3. **Next earnings date** — exact date or quarter
4. **Catalysts** — upcoming events, product launches, partnerships, macro tailwinds, any news from the past 2–4 weeks
5. **Fed/Macro risk** — assess as LOW / MEDIUM / HIGH for this specific stock, with a one-line reason

Use WebSearch with queries like:
- `"<TICKER> analyst price target 2026 site:stockanalysis.com OR site:tipranks.com"`
- `"<TICKER> earnings date next quarter 2026"`
- `"<TICKER> news catalyst June 2026"`

Do NOT generate the report until you have real data. If a search fails, say so and try an alternative search.

## Step 2: Plan the report sections

Before writing HTML, decide these values explicitly (write them out in your thinking):

| Section | What to fill in |
|---------|----------------|
| Company description (Thai) | 3–4 sentences in Thai: what does this company do, what's their AI/tech angle, why does it matter right now |
| companyDescription (EN) | One-line English business type tag: `"Sector · Short hook"` e.g. `"AI GPU · Dominant H100/Blackwell chips + CUDA ecosystem"` |
| Catalyst timeline | 3 catalysts with dates (NOW / SOON / LATER), dot color by urgency |
| Entry Point (3 levels) | Entry 1 (preferred/current), Entry 2 (dip), Entry 3 (deep/bear) — with % from current price |
| TP1 / TP2 / TP3 | Grounded in analyst targets; calculate % from preferred entry |
| Stop Loss | Tight stop (~7–12%), Hard stop (structural break), R/R ratio |
| Estimate Dates | When price is likely to reach each TP (tie to catalyst dates) |
| Upside Bars | Bear / Base / Bull / Moon — price and % from preferred entry |
| Verdict | 🟢 Core holding / 🟡 Speculative / 🔴 ค่าขนม |
| Fed Risk | LOW / MEDIUM / HIGH + one-line reason |

## Step 3: Generate the HTML report

Use the visual system below. The output file must be saved as:
`<TICKER>_report_<YYYYMMDD>.html`
in the user's workspace folder.

### Visual System

```
Background:   #0f172a  (page bg)
Card bg:      #1e293b
Card inner:   #0f172a  (info blocks)
Deep bg:      #0a111e  (card summary strip)

Green:   #10b981  → Core holding, positive values, bull bars
Yellow:  #f59e0b  → Speculative, medium signals, base bars
Red:     #ef4444  → ค่าขนม, stop loss, bear bars
Blue:    #38bdf8  → dates, brand color
Purple:  #a78bfa  → moon scenario, upside blocks
Grey:    #94a3b8  → secondary text

Accent bar on card top (3px gradient):
  Core → #10b981 to #34d399
  Spec → #f59e0b to #fbbf24
  Risky → #ef4444 to #f87171
  Custom tickers → use brand color (Intel blue, AMD red, etc.)
```

### Required HTML Sections (in order)

1. **Top Banner** — XVARY brand, report title (TICKER — one-line hook), date, verdict pill
2. **Macro Bar** — Fed status + how it affects this specific stock (NEUTRAL / HAWKISH / DOVISH), Fed Risk verdict
3. **Warning box (if needed)** — yellow warning if stock is extended/overbought and user should wait for a dip
4. **Quick Overview Table** — single row: Ticker | Price | Entry Zone | TP1 | TP2 | Stop Loss | Bull Upside | Key Date | Verdict
5. **Full Stock Card** with 6 info blocks in a 3-column grid:
   - ⚡ Catalyst (3 items with colored dots + date chips)
   - 🎯 Entry Point (3 levels with PREFERRED chip on best entry)
   - ✅ Take Profit (TP1 / TP2 / TP3 with % from entry)
   - 🛑 Stop Loss (tight / hard / R:R ratio)
   - 📅 Estimate Date (3 timeline milestones with estimated prices)
   - 📈 Possible Up % (Bear / Base / Bull / Moon bar chart)
6. **Card Summary strip** — 2–3 sentence Thai verdict, recommended position size %
7. **Analyst Targets Table** (if 3+ named targets exist) — Firm | Target | Rating | vs Entry | Note
8. **Sources** — all URLs used during research
9. **Footer** — "Not financial advice · XVARY Research · {date}"

### Info Block Template

```html
<div class="info-block">
  <div class="ib-title ib-t-{type}">{icon} {Title}</div>
  <div class="ib-row">
    <div class="ib-label">Label<small>sub-label</small></div>
    <div class="ib-val c-{color}">Value<span class="ib-pct">+X%</span></div>
  </div>
  <!-- repeat ib-row for each item -->
</div>
```

Types: `catalyst`, `entry`, `tp`, `sl`, `date`, `upside`
Colors: `green`, `yellow`, `red`, `blue`, `purple`, `grey`, `white`

### Upside Bar Template

```html
<div class="upside-row">
  <div class="upside-scenario" style="color:#ef4444">Bear</div>
  <div class="upside-bar-wrap"><div class="upside-bar bar-bear" style="width:{pct}%"></div></div>
  <div class="upside-pct c-red">-X%</div>
  <div class="upside-price">$XXX</div>
</div>
```

Bar widths: Bear is proportional to Moon (Moon = 100%). Calculate: `bear_width = abs(bear_pct) / moon_pct * 100`.

### Catalyst Item Template

```html
<div class="catalyst-item">
  <div class="cat-dot" style="background:#ef4444"></div>
  <div class="cat-content">
    <strong>Title</strong> — description
    <div><span class="cat-date date-now">Jun 18, 2026</span></div>
  </div>
</div>
```

Date classes: `date-now` (red, immediate), `date-soon` (yellow, weeks away), `date-later` (grey, months away)

## Step 3.5: Price Verification (mandatory — do before presenting)

After generating the HTML/JSON but BEFORE presenting to the user, verify the price is current by fetching from **multiple sources in priority order**. Stop at the first source that returns a fresh price for today.

### Source Priority

**Source 1 (Primary — Real-time):** `mcp__workspace__web_fetch` on StockAnalysis
```
url: https://stockanalysis.com/stocks/<TICKER>/
```
Parse the rendered page for the price line. Look for patterns like:
- `210.21\n\n-0.48 (-0.23%)\n\nJun 22, 2026` — real-time intraday ✅
- `400.49\n\nAt close: Jun 18, 2026` — last close (may be stale if market is open) ⚠️
- `92.06\n\nAt close: Jun 8, 2026` — very stale ❌ skip to next source

Also extract `Previous Close` from the stats table for priceChange calculation.

**Source 2 (Fallback — Search):** `WebSearch`
```
query: "<TICKER> stock price today <MonthYear>"
```
Search results usually return previous close or intraday from financial sites. Use only if Source 1 is stale.

**Source 3 (Context):** If both sources fail or are ambiguous, note in `priceNote` that price is from research and may be delayed.

### Decision Logic

After fetching, compare the live price against the report's research price:

- **Difference ≤ 2%** → log `✅ Price verified: $X.XX (source)` and proceed
- **Difference > 2%** → log `⚠️ Price mismatch: research $X vs live $Y — updating`
  - Update `price` to the live price
  - Recalculate `priceChange` using `(livePrice - previousClose) / previousClose * 100`
  - Update `priceNote` to include source and context (e.g., Google fears, catalyst day)
  - Update Entry 1 level to current price
  - Recalculate all `pct` fields in tp1/tp2/tp3, stopLoss tightPct/hardPct, and scenario pct
  - Re-save the JSON with corrected values

### Known Limitations
- StockAnalysis may cache stale data for low-volume or recently-halted tickers
- WebSearch typically returns previous close, not intraday
- Yahoo Finance API is blocked in sandbox environments — do not attempt
- When market is closed (weekends, holidays), "live" price = last closing price — this is correct behavior

**Why this matters:** WebSearch and research sources lag real-time by hours or days. A stale price produces wrong TP% figures and wrong R/R ratios — the exact numbers a trader acts on. Multi-source verification catches edge cases like holiday-adjusted prices (e.g., Juneteenth) and ex-dividend drops that aren't reflected in search results.

## Step 4: Save HTML + JSON + Git Push (all three are mandatory)

Every `/analyze` report must do all of these — skipping JSON or git push means the dashboard stays stale.

### 4a — Save HTML

Save the HTML to `<TICKER>_report_<YYYYMMDD>.html` in the workspace folder (for the user to view).

### 4b — Save JSON to web/data/reports/

Save a JSON file to `web/data/reports/<TICKER>_<YYYYMMDD>.json` in the project folder. This is what the live dashboard reads — without it, the dashboard shows the old report.

The JSON must follow the full `StockReport` schema defined in `web/lib/types.ts`. Key required fields:

```json
{
  "ticker": "NVDA",
  "companyName": "NVIDIA Corporation",
  "companyDescription": "AI GPU · one-line English tag",
  "exchange": "NASDAQ",
  "generatedAt": "<ISO timestamp>",
  "price": 131.38,
  "priceChange": 2.4,
  "priceNote": "Short price context note",
  "marketCap": "$3.2T",
  "sector": "Technology / Semiconductors",
  "verdict": "BUY",
  "scoreLabel": "Core Holding",
  "score": 85,
  "summary": "2-3 sentence English thesis",
  "catalysts": [{ "icon": "⚡", "name": "...", "description": "...", "urgencyLabel": "2 DAYS", "dateBadge": "Jun 20, 2026", "catalystDate": "2026-06-20", "badgeColor": "red", "dotColor": "yellow" }],
  "risks": ["Risk 1", "Risk 2", "Risk 3"],
  "estimateDates": [{ "event": "...", "dateRange": "...", "note": "...", "est": "...", "highlight": "blue" }],
  "scenarios": [
    { "label": "Bear", "color": "red", "pct": -20, "price": 105 },
    { "label": "Base", "color": "yellow", "pct": 14, "price": 150 },
    { "label": "Bull", "color": "green", "pct": 26, "price": 165 },
    { "label": "Moon", "color": "purple", "pct": 41, "price": 185 }
  ],
  "analystTargets": [{ "firm": "Goldman Sachs", "target": 160, "rating": "Buy" }],
  "macroRisk": { "fedRisk": "MEDIUM", "rateOutlook": "...", "inflationNote": "...", "sectorImpact": "...", "summary": "..." },
  "entryStrategy": {
    "entryLevels": [
      { "label": "Entry 1", "level": 131, "note": "...", "timing": "Now" },
      { "label": "Entry 2", "level": 120, "rangeMax": 125, "note": "...", "timing": "If dips", "preferred": true },
      { "label": "Entry 3", "level": 108, "note": "...", "timing": "Deep dip" }
    ],
    "tp1": { "price": 150, "pct": 14.2, "note": "..." },
    "tp2": { "price": 165, "pct": 25.6, "note": "..." },
    "tp3": { "price": 185, "pct": 40.8, "note": "...", "moon": true },
    "stopLoss": { "tight": 118, "tightPct": -10, "tightNote": "...", "hard": 102, "hardPct": -22, "hardNote": "...", "riskReward": "2.5 : 1", "rrNote": "...", "rrWarning": "..." },
    "verdict": "One-line verdict",
    "approach": "DCA"
  },
  "catalystSpot": { "catalystType": "earnings_beat", "preRunup": "...", "preRunupTiming": "...", "preRunupPct": "...", "postWin": { "avgPct": 15, "range": "...", "note": "...", "exampleDate": "..." }, "postLose": { "avgPct": -12, "range": "...", "note": "...", "exampleDate": "..." }, "spotSizing": { "pct": 5, "reason": "..." }, "stopPreCatalyst": { "pct": -10, "price": 0, "note": "..." }, "stopPostCatalyst": { "pct": -15, "note": "..." } },
  "comparableCases": [{ "ticker": "...", "event": "...", "date": "Mon YYYY", "movePct": 20, "days": 2, "outcome": "good", "note": "..." }],
  "rankChangeSource": { "headline": "...", "url": "https://...", "date": "Mon YYYY" },
  "sources": ["https://..."],
  "i18n": {
    "th": {
      "summary": "Thai summary",
      "priceNote": "Thai price note",
      "scoreLabel": "Core Holding",
      "catalysts": [{ "name": "...", "description": "..." }],
      "risks": ["..."],
      "macroRisk": { "rateOutlook": "...", "inflationNote": "...", "sectorImpact": "...", "summary": "..." },
      "entryStrategy": { "verdict": "...", "entryLevels": [{ "note": "...", "timing": "..." }, { "note": "...", "timing": "..." }, { "note": "...", "timing": "..." }], "tp1": { "note": "..." }, "tp2": { "note": "..." }, "tp3": { "note": "..." }, "stopLoss": { "tightNote": "...", "hardNote": "...", "rrNote": "...", "rrWarning": "..." } },
      "estimateDates": [{ "event": "...", "note": "..." }]
    }
  }
}
```

**Valid enum values:**
- `verdict`: `"BUY"` | `"HOLD"` | `"SELL"` | `"SPECULATIVE"`
- `scoreLabel`: `"Core Holding"` | `"Speculative"` | `"ค่าขนม"`
- `dotColor`: `"red"` | `"yellow"` | `"green"` | `"gray"`
- `badgeColor`: `"red"` | `"yellow"` | `"green"` | `"blue"`
- `approach`: `"DCA"` | `"Lump Sum"` | `"Scale In"`
- `catalystType`: `"earnings_beat"` | `"satellite_launch"` | `"fda_decision"` | `"foundry_validation"` | `"delivery_beat"` | `"partnership_win"` | `"product_launch"` | `"regulatory_approval"`
- `outcome` (comparableCases): `"good"` | `"mixed"` | `"bad"`
- `highlight` (estimateDates): `"blue"` | `"yellow"`

**Why JSON matters:** The HTML file is for the user to read right now. The JSON file is what the Next.js dashboard at `web/` reads. Without the JSON, the dashboard shows the old stale report. Both must be saved.

If a JSON report for the same ticker already exists for today, overwrite it.

### 4c — Git commit and push

After saving both files, run:

```bash
cd <project-root>   # e.g. /path/to/stock-radar-weekly
git add web/data/reports/
git commit -m "report: add <TICKER> report <YYYYMMDD>"
git push origin main
```

This triggers Vercel to redeploy the live dashboard automatically.

**IMPORTANT — never commit `private/journal.json`:** Only add `web/data/reports/`. Never `git add private/` or `git add .`.

If git push fails (no credentials in sandbox), tell the user: "Commit created locally — please run `git push origin main` (or `feature/improve`) to deploy."

### 4d — Present and confirm

1. Call `present_files` to share the HTML file with the user
2. Confirm in one line: `✅ <TICKER> report saved → JSON to web/data/reports/ → pushed to GitHub → Vercel deploying`
3. Give a 1–2 sentence summary: verdict, best entry level, and key catalyst date

## Always-on rules

- Every JSON report must include `companyDescription` — one-line English tag: `"Sector · Short hook"` e.g. `"AI GPU · Dominant H100/Blackwell chips + CUDA"` and `i18n.th.companyDescription` in Thai
- Research FIRST, HTML second — never fabricate prices or analyst targets
- Every report includes Fed risk verdict (LOW / MEDIUM / HIGH) and the reason
- Every report includes 3 entry levels, TP1/TP2/TP3, stop loss, and R/R ratio
- Company description is always in Thai (3–4 sentences)
- Cite all sources used in the Sources section
- Append "Not financial advice · XVARY Research" in the footer
- Position sizing guidance in the card summary (e.g., "แนะนำ 20–30% ของ capital")
- If the stock surged more than 5% today → add a yellow warning box telling user to wait for pullback

## Language style

Mix English + Thai shorthand naturally:
- Verdict: 🟢 Core holding / 🟡 Speculative / 🔴 ค่าขนม
- Entry labels: NOW / PREFERRED / Deep dip / Bear dip
- Summary strip: Thai sentences with English ticker/price/% data inline
- Catalyst dates: English format (Jun 18, 2026) inside Thai sentences

## Example trigger phrases

These all trigger this skill:
- "analyze NVDA for me"
- "ขอรายงาน AMD"
- "/analyze TSLA"
- "AVGO entry plan"
- "ขอ full report MSFT"
- "วิเคราะห์ ASTS ให้หน่อย"
- Just saying "INTC" after context about wanting analysis
