---
name: analyze
description: >
  Full institutional stock analysis report. Triggered by `/analyze <TICKER>`.
  Researches live price, news, earnings catalyst, Fed/macro risk, generates
  a dark-theme HTML preview AND saves a StockReport JSON to
  web/data/reports/<TICKER>_<YYYYMMDD>.json, then validates and git pushes so
  the dashboard updates automatically. Use for any single-ticker deep dive.
---

# /analyze Command — Stock Analysis Report

## Usage
```
/analyze NVDA
/analyze MU options play June 24 earnings
/analyze RKLB +30% in 30 days
```
Arguments after the ticker are optional context hints (e.g. timeframe, instrument type).

---

## Step 1 — Research (always run ALL searches in parallel)

Run these web searches simultaneously before writing a single word of the report:

```
1. "<TICKER> stock price today news <current_month> <current_year>"
2. "<TICKER> earnings date next quarter analyst price target"
3. "<TICKER> recent catalyst options implied move"
4. "Fed funds rate FOMC next meeting date <current_year> CME FedWatch"
5. "CPI jobs report upcoming dates <current_month> <current_year>"
```

Collect and hold:
- Current price and % change today
- Why the stock is moving (if notable)
- Next earnings date and guidance (if available)
- Analyst consensus rating and average price target
- High / low analyst targets
- Options implied move at earnings (if options play)
- Fed funds rate (current target range)
- Next FOMC meeting date and market-implied probability of hike/cut
- Next CPI date and last reading
- Next NFP (jobs) date

---

## Step 2 — Build the report

Generate a single self-contained dark-theme HTML file using the template below.
Fill every `{{PLACEHOLDER}}` with researched data.
Do not fabricate prices, dates, or probabilities.

### HTML Report Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{TICKER}} · Stock Radar Research</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f1117; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; padding: 24px; max-width: 960px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 600; color: #f8fafc; }
  h2 { font-size: 13px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #64748b; margin: 0 0 12px; }
  .card { background: #1e2330; border: 1px solid #2d3748; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .kv { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #2d3748; font-size: 13px; }
  .kv:last-child { border-bottom: none; }
  .k { color: #94a3b8; }
  .v { font-weight: 600; color: #f1f5f9; text-align: right; }
  .v.up { color: #10b981; }
  .v.dn { color: #ef4444; }
  .v.warn { color: #f59e0b; }
  .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 6px; }
  .badge-green { background: #064e3b; color: #10b981; }
  .badge-amber { background: #451a03; color: #f59e0b; }
  .badge-red { background: #450a0a; color: #ef4444; }
  .badge-blue { background: #0c1a3a; color: #60a5fa; }
  .badge-gray { background: #1e293b; color: #94a3b8; }
  .price-cell { background: #0f1117; border: 1px solid #2d3748; border-radius: 8px; padding: 12px; text-align: center; }
  .price-cell-label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
  .price-cell-val { font-size: 18px; font-weight: 700; color: #f8fafc; }
  .price-cell-sub { font-size: 11px; color: #475569; margin-top: 2px; }
  .tp-row { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px solid #2d3748; font-size: 13px; }
  .tp-row:last-child { border-bottom: none; }
  .tp-label { font-weight: 700; min-width: 40px; color: #94a3b8; font-size: 12px; }
  .tp-price { font-weight: 700; min-width: 80px; color: #f1f5f9; }
  .tp-pct { color: #10b981; font-size: 12px; min-width: 50px; }
  .tp-action { color: #64748b; font-size: 12px; flex: 1; text-align: right; }
  .verdict { border-left: 3px solid #f59e0b; border-radius: 0 8px 8px 0; background: #1a1f2e; padding: 12px 16px; font-size: 13px; font-weight: 600; color: #f1f5f9; margin-top: 12px; line-height: 1.5; }
  .verdict.green { border-left-color: #10b981; }
  .verdict.red { border-left-color: #ef4444; }
  .sources { font-size: 11px; color: #475569; margin-top: 16px; line-height: 2; }
  .sources a { color: #60a5fa; text-decoration: none; }
  .footer { text-align: center; font-size: 11px; color: #334155; margin-top: 24px; padding-top: 16px; border-top: 1px solid #1e2330; }
  .why-tag { display: inline-flex; align-items: center; gap: 6px; background: #1e2330; border: 1px solid #2d3748; border-radius: 6px; padding: 5px 10px; font-size: 12px; color: #94a3b8; margin: 0 4px 4px 0; }
</style>
</head>
<body>

<!-- ═══ HEADER ═══ -->
<div class="card" style="margin-bottom:16px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:12px">
    <div>
      <div style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">{{COMPANY_NAME}} · {{EXCHANGE}}:{{TICKER}}</div>
      <h1>{{TICKER}} <span style="font-size:16px;font-weight:400;color:{{PRICE_COLOR}}">{{CURRENT_PRICE}} <span style="font-size:13px">{{PRICE_CHANGE_PCT}}% today</span></span></h1>
      <div style="font-size:12px;color:#64748b;margin-top:4px">ATH: {{ATH}} · Earnings: {{EARNINGS_DATE}} ({{DAYS_TO_EARNINGS}} days) · Options implied ±{{OPTIONS_MOVE}}%</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#64748b;margin-bottom:4px">Analyst consensus</div>
      <div style="font-size:14px;font-weight:700;color:#f1f5f9">{{CONSENSUS_RATING}}</div>
      <div style="font-size:12px;color:#10b981">Avg PT: {{AVG_PRICE_TARGET}} · High: {{HIGH_PT}}</div>
    </div>
  </div>
  <div style="font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600">Why it's moving</div>
  {{WHY_TAGS}}
</div>

<!-- ═══ FED / MACRO RISK ═══ -->
<div class="card">
  <h2>Section 1 — Fed / Macro Risk</h2>
  <div class="grid2" style="margin-bottom:16px">
    <div>
      <div style="font-size:12px;color:#64748b;margin-bottom:8px;font-weight:600">Rate environment</div>
      <div class="kv"><span class="k">Fed funds rate</span><span class="v">{{FED_RATE}}</span></div>
      <div class="kv"><span class="k">Next FOMC</span><span class="v">{{FOMC_DATE}}</span></div>
      <div class="kv"><span class="k">Hold probability</span><span class="v up">{{HOLD_PROB}}%</span></div>
      <div class="kv"><span class="k">Hike probability (2026)</span><span class="v {{HIKE_COLOR}}">{{HIKE_PROB}}%</span></div>
      <div class="kv"><span class="k">10yr Treasury</span><span class="v {{YIELD_COLOR}}">{{YIELD}}%</span></div>
    </div>
    <div>
      <div style="font-size:12px;color:#64748b;margin-bottom:8px;font-weight:600">{{TICKER}} sensitivity</div>
      <div class="kv"><span class="k">Sector</span><span class="v">{{SECTOR}}</span></div>
      <div class="kv"><span class="k">Rate sensitivity</span><span class="v {{RATE_SENS_COLOR}}">{{RATE_SENSITIVITY}}</span></div>
      <div class="kv"><span class="k">+25bps hike impact</span><span class="v dn">{{HIKE_IMPACT}}</span></div>
      <div class="kv"><span class="k">Beta</span><span class="v">{{BETA}}</span></div>
    </div>
  </div>

  <div style="font-size:12px;color:#64748b;margin-bottom:8px;font-weight:600">Macro events before catalyst</div>
  <div class="kv"><span class="k">{{MACRO_EVENT_1_DATE}}</span><span class="v" style="font-weight:400;font-size:12px">{{MACRO_EVENT_1_DESC}}</span></div>
  <div class="kv"><span class="k">{{MACRO_EVENT_2_DATE}}</span><span class="v" style="font-weight:400;font-size:12px">{{MACRO_EVENT_2_DESC}}</span></div>
  <div class="kv"><span class="k">{{MACRO_EVENT_3_DATE}}</span><span class="v" style="font-weight:400;font-size:12px">{{MACRO_EVENT_3_DESC}}</span></div>

  <div style="font-size:12px;color:#64748b;margin:12px 0 6px;font-weight:600">Fed Risk Verdict</div>
  <div class="verdict {{FED_VERDICT_CLASS}}">
    <span style="color:{{FED_VERDICT_COLOR}};font-size:15px;vertical-align:-1px">●</span>
    {{FED_RISK_LEVEL}} FED RISK — {{FED_VERDICT_TEXT}}
  </div>
</div>

<!-- ═══ ENTRY STRATEGY ═══ -->
<div class="card">
  <h2>Section 2 — Entry Strategy</h2>

  <div style="margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    <span style="font-size:12px;color:#64748b;font-weight:600">Entry type:</span>
    <span class="badge {{ENTRY_TYPE_BADGE}}">{{ENTRY_TYPE}}</span>
    <span style="font-size:12px;color:#64748b">{{ENTRY_TYPE_REASON}}</span>
  </div>

  <div class="grid3" style="margin-bottom:16px">
    <div class="price-cell">
      <div class="price-cell-label">Aggressive entry</div>
      <div class="price-cell-val">{{ENTRY_AGGRESSIVE}}</div>
      <div class="price-cell-sub">{{ENTRY_AGGRESSIVE_NOTE}}</div>
    </div>
    <div class="price-cell">
      <div class="price-cell-label">Base entry</div>
      <div class="price-cell-val">{{ENTRY_BASE}}</div>
      <div class="price-cell-sub">{{ENTRY_BASE_NOTE}}</div>
    </div>
    <div class="price-cell">
      <div class="price-cell-label">Strong entry</div>
      <div class="price-cell-val">{{ENTRY_STRONG}}</div>
      <div class="price-cell-sub">{{ENTRY_STRONG_NOTE}}</div>
    </div>
  </div>

  <div class="grid2">
    <div>
      <div style="font-size:12px;color:#64748b;margin-bottom:8px;font-weight:600">Take profit</div>
      <div class="tp-row">
        <span class="tp-label">TP1</span>
        <span class="tp-price">{{TP1_PRICE}}</span>
        <span class="tp-pct">{{TP1_PCT}}</span>
        <span class="tp-action">trim 30–50%</span>
      </div>
      <div class="tp-row">
        <span class="tp-label">TP2</span>
        <span class="tp-price">{{TP2_PRICE}}</span>
        <span class="tp-pct">{{TP2_PCT}}</span>
        <span class="tp-action">trim 30%</span>
      </div>
      <div class="tp-row">
        <span class="tp-label">TP3</span>
        <span class="tp-price">{{TP3_PRICE}}</span>
        <span class="tp-pct">{{TP3_PCT}}</span>
        <span class="tp-action">let it ride</span>
      </div>
    </div>
    <div>
      <div style="font-size:12px;color:#64748b;margin-bottom:8px;font-weight:600">Risk management</div>
      <div class="kv"><span class="k">Position size</span><span class="v">{{POSITION_SIZE}}</span></div>
      <div class="kv"><span class="k">Stop loss</span><span class="v dn">{{STOP_LOSS}}</span></div>
      <div class="kv"><span class="k">Max risk per trade</span><span class="v">{{MAX_RISK}}</span></div>
    </div>
  </div>

  <div class="verdict green">
    → {{ENTRY_VERDICT}}
  </div>
</div>

<!-- ═══ SOURCES ═══ -->
<div class="sources">
  <strong style="color:#64748b">Sources:</strong><br>
  {{SOURCES_LIST}}
</div>

<div class="footer">Stock Radar Research · {{REPORT_DATE}} · Not financial advice</div>

</body>
</html>
```

---

## Step 3 — Save HTML preview

1. Fill all `{{PLACEHOLDER}}` values with real researched data
2. Save the completed HTML to the scratchpad as `{{TICKER}}_report_{{YYYYMMDD}}.html`
3. Present the file to the user with `mcp__cowork__present_files`

---

## Step 4 — Save JSON to dashboard + push

After the HTML, build and save the **StockReport JSON** so the dashboard updates.

### 4a — Write JSON

Save to: `web/data/reports/<TICKER>_<YYYYMMDD>.json`

Use the full `StockReport` schema from `web/lib/types.ts` (same schema as `/catalyst-list`).
Key fields to populate from research:

```json
{
  "ticker": "NVDA",
  "companyName": "...",
  "companyDescription": "...",
  "exchange": "NASDAQ",
  "generatedAt": "<ISO timestamp>",
  "price": 134.20,
  "priceChange": -3.2,
  "priceNote": "...",
  "marketCap": "...",
  "sector": "...",
  "verdict": "BUY | HOLD | SELL | SPECULATIVE",
  "scoreLabel": "Core Holding | Speculative | ค่าขนม",
  "score": 80,
  "summary": "...",
  "catalysts": [ { "icon":"⚡","name":"...","description":"...","urgencyLabel":"...","dateBadge":"...","catalystDate":"YYYY-MM-DD","badgeColor":"red|yellow|green|blue","dotColor":"red|yellow|green|gray" } ],
  "risks": ["..."],
  "estimateDates": [ { "event":"...","dateRange":"...","note":"...","est":"...","highlight":"blue|yellow" } ],
  "scenarios": [
    { "label":"Bear","color":"red","pct":-20,"price":0 },
    { "label":"Base","color":"yellow","pct":15,"price":0 },
    { "label":"Bull","color":"green","pct":30,"price":0 },
    { "label":"Moon","color":"purple","pct":55,"price":0 }
  ],
  "analystTargets": [ { "firm":"...","target":0,"rating":"Buy","note":"..." } ],
  "macroRisk": { "fedRisk":"LOW|MEDIUM|HIGH","rateOutlook":"...","inflationNote":"...","sectorImpact":"...","summary":"..." },
  "entryStrategy": {
    "entryLevels": [
      { "label":"Entry 1","level":0,"note":"...","timing":"Now" },
      { "label":"Entry 2","level":0,"rangeMax":0,"note":"...","timing":"If dips","preferred":true },
      { "label":"Entry 3","level":0,"note":"...","timing":"Deep dip" }
    ],
    "tp1": { "price":0,"pct":0,"note":"..." },
    "tp2": { "price":0,"pct":0,"note":"..." },
    "tp3": { "price":0,"pct":0,"note":"...","moon":true },
    "stopLoss": { "tight":0,"tightPct":0,"tightNote":"...","hard":0,"hardPct":0,"hardNote":"...","riskReward":"X:1","rrNote":"...","rrWarning":"..." },
    "verdict": "...",
    "approach": "DCA | Lump Sum | Scale In"
  },
  "catalystSpot": { "catalystType":"earnings_beat|product_launch|...","preRunup":"...","preRunupTiming":"...","preRunupPct":"...","postWin":{"avgPct":0,"range":"...","note":"...","exampleDate":"..."},"postLose":{"avgPct":0,"range":"...","note":"...","exampleDate":"..."},"spotSizing":{"pct":0,"reason":"..."},"stopPreCatalyst":{"pct":0,"price":0,"note":"..."},"stopPostCatalyst":{"pct":0,"note":"..."} },
  "comparableCases": [ { "ticker":"...","event":"...","date":"Mon YYYY","movePct":0,"days":0,"outcome":"good|mixed|bad","note":"..." } ],
  "rankChangeSource": { "headline":"...","url":"https://...","date":"Mon YYYY" },
  "sources": ["https://..."],
  "i18n": { "th": { "summary":"...","priceNote":"...","scoreLabel":"...","catalysts":[{"name":"...","description":"..."}],"risks":["..."],"macroRisk":{"rateOutlook":"...","inflationNote":"...","sectorImpact":"...","summary":"..."},"entryStrategy":{"verdict":"...","entryLevels":[{"note":"...","timing":"..."},{"note":"...","timing":"..."},{"note":"...","timing":"..."}],"tp1":{"note":"..."},"tp2":{"note":"..."},"tp3":{"note":"..."},"stopLoss":{"tightNote":"...","hardNote":"...","rrNote":"...","rrWarning":"..."}},"estimateDates":[{"event":"...","note":"..."}] } }
}
```

Rules:
- `sources[]` must have ≥1 real URL (≥2 preferred)
- `catalystDate` must be set on at least the nearest catalyst (ISO `YYYY-MM-DD`)
- `score` is recomputed at load time by `web/lib/scoring.ts` — fill grounded fields accurately
- If a report for the same ticker already exists for today, overwrite it

### 4b — Validate and push

```bash
node scripts/validate-reports.mjs
git add web/data/reports/
git commit -m "report: add <TICKER> report <YYYYMMDD>"
git push
```

### 4c — Confirm

Print a 3-line summary in chat:
- Current price + % change
- Fed risk verdict (one line)
- Entry verdict (one line)
- `✅ <TICKER> report saved → pushed to GitHub → Vercel deploying`

---

## Placeholder reference

| Placeholder | Example |
|---|---|
| `{{TICKER}}` | `NVDA` |
| `{{COMPANY_NAME}}` | `NVIDIA Corporation` |
| `{{EXCHANGE}}` | `NASDAQ` |
| `{{CURRENT_PRICE}}` | `$134.20` |
| `{{PRICE_CHANGE_PCT}}` | `-3.2` |
| `{{PRICE_COLOR}}` | `#ef4444` (red if down) or `#10b981` (green if up) |
| `{{ATH}}` | `$153.13` |
| `{{EARNINGS_DATE}}` | `Aug 27` |
| `{{DAYS_TO_EARNINGS}}` | `76` |
| `{{OPTIONS_MOVE}}` | `8` |
| `{{CONSENSUS_RATING}}` | `Strong Buy` |
| `{{AVG_PRICE_TARGET}}` | `$175.00` |
| `{{HIGH_PT}}` | `$220.00` |
| `{{WHY_TAGS}}` | HTML `<span class="why-tag">` blocks |
| `{{FED_RATE}}` | `3.50 – 3.75%` |
| `{{FOMC_DATE}}` | `June 17` |
| `{{HOLD_PROB}}` | `99.4` |
| `{{HIKE_PROB}}` | `70` |
| `{{HIKE_COLOR}}` | `warn` or `dn` |
| `{{YIELD}}` | `4.51` |
| `{{YIELD_COLOR}}` | `warn` |
| `{{SECTOR}}` | `Semiconductors / AI` |
| `{{RATE_SENSITIVITY}}` | `HIGH` |
| `{{RATE_SENS_COLOR}}` | `dn` |
| `{{HIKE_IMPACT}}` | `-5 to -8% valuation` |
| `{{BETA}}` | `~1.8` |
| `{{MACRO_EVENT_x_DATE}}` | `June 11` |
| `{{MACRO_EVENT_x_DESC}}` | `CPI print — hot = risk-off pressure` |
| `{{FED_VERDICT_CLASS}}` | `green` / `""` (amber) / `red` |
| `{{FED_VERDICT_COLOR}}` | `#10b981` / `#f59e0b` / `#ef4444` |
| `{{FED_RISK_LEVEL}}` | `LOW` / `MEDIUM` / `HIGH` |
| `{{FED_VERDICT_TEXT}}` | One-sentence explanation |
| `{{ENTRY_TYPE}}` | `DCA / Split entry` |
| `{{ENTRY_TYPE_BADGE}}` | `badge-amber` |
| `{{ENTRY_TYPE_REASON}}` | Short reason |
| `{{ENTRY_AGGRESSIVE}}` | `$134` |
| `{{ENTRY_BASE}}` | `$125` |
| `{{ENTRY_STRONG}}` | `$115` |
| `{{ENTRY_x_NOTE}}` | `Current price` / `-7% dip` / `-15% selloff` |
| `{{TP1_PRICE}}` | `$154` |
| `{{TP1_PCT}}` | `+15%` |
| `{{POSITION_SIZE}}` | `5–10% (Speculative)` |
| `{{STOP_LOSS}}` | `$118 (-12%)` |
| `{{MAX_RISK}}` | `Full position if thesis breaks` |
| `{{ENTRY_VERDICT}}` | One-line DCA plan |
| `{{SOURCES_LIST}}` | `<a href="...">Title</a>` per line |
| `{{REPORT_DATE}}` | `June 12, 2026` |

---

## Notes
- If user specifies "options play" → add an options section: expiry choice, strike, max premium
- If user specifies a timeframe ("30 days", "before earnings") → use that as the TP horizon
- If the ticker is unknown / delisted → say so clearly, do not hallucinate prices
- Always verify earnings date before writing it — wrong dates break the thesis

## 📈 Stock Timeline — How it builds

Every time `/analyze TICKER` runs, it saves a new `TICKER_YYYYMMDD.json` to `web/data/reports/`. The `StockTimeline` component in the web dashboard reads **all** JSON files for that ticker and plots Score, TP2, and Rank over time as sparklines.

**ผลลัพธ์:** ยิ่งรัน `/analyze` บ่อย timeline ยิ่ง rich — แต่ถ้ามีแค่ 1 ไฟล์ จะเห็นแค่ "1 snapshot · First snapshot — check back next week"

**แนวทาง:** รัน `/analyze` ซ้ำเมื่อ:
- มี catalyst ใหม่ (earnings, product launch, news)
- ราคาเปลี่ยนมากกว่า 10% จาก last report
- หรือทุกสัปดาห์ถ้าต้องการ trend ที่ชัดเจน

แต่ละ report ใหม่จะสร้าง snapshot ใหม่โดยอัตโนมัติ ไม่ต้องทำอะไรพิเศษ
