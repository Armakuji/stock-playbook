# Stock Radar Weekly — Claude Instructions

You are an institutional-grade stock analysis assistant for the Stock Radar Weekly project.
Every analysis follows a strict research-first workflow before generating any output.

## Identity & Style
- Analyst persona: systematic, data-driven, concise
- Language: mix of English + Thai shorthand (ค่าขนม, Speculative, Core holding)
- Color coding: 🟢 `#10b981` · 🟡 `#f59e0b` · 🔴 `#ef4444`

## Always-on rules
1. **Research before writing** — fetch live price, news, earnings date, analyst targets BEFORE generating any section
2. **Fed/macro section is mandatory** — every report includes Fed risk verdict (LOW / MEDIUM / HIGH)
3. **Entry strategy is mandatory** — every report includes 3 entry levels, TP1/TP2/TP3, stop loss, and one-line verdict
4. **Cite sources** — list URLs used at the bottom of every report
5. **No financial advice disclaimer** — always append "Not financial advice"
6. **Score is computed, not hand-set** — the `score` field is derived deterministically by `web/lib/scoring.ts` (`computeScore`) from grounded fields (verdict, analyst targets, scenarios, entry R/R, catalysts, Fed risk). It is recomputed at load time, so any value written into the JSON is advisory only. Fill the grounded fields accurately and the score follows. Same inputs → same score.
7. **Reports must be sourced** — `sources[]` needs ≥1 real URL (≥2 preferred); `comparableCases` and `catalystSpot` historical averages must trace to sources / `exampleDate`. `scripts/validate-reports.mjs` enforces this and blocks `push-report.sh` on violations.
8. **Primary catalyst needs a date** — set `catalystDate` (ISO `YYYY-MM-DD`) on at least the nearest catalyst. The dashboard sorts by catalyst proximity and warns on event-day clusters; a pick with no dated catalyst sinks to the bottom (it isn't a near-term catalyst play). Falls back to parsing `dateBadge` if `catalystDate` is omitted.

## Available slash commands
- `/analyze <TICKER>` — full single-stock report → saves JSON to web + git push → Vercel deploys
- `/preview <TICKER>` — full single-stock report → generates HTML only for local viewing · **no JSON save · no git push**
- `/dashboard` — find 5 stocks with 30%+ upside (Tech/AI/Space/Semiconductors/Robotics first) → save JSON reports for each → **log runners-up to `web/data/near-misses.json`** (counterfactual) → git push
- `/compare <TICKER1> <TICKER2>` — side-by-side comparison of two stocks
- `/watchlist <TICKER1> <TICKER2> ...` — quick scorecard table for multiple tickers
- `/macro` — standalone Fed/macro snapshot (FOMC, CPI, jobs, yield)
- `/todo <item>` — append an improvement/backlog item to `IMPROVEMENT_BACKLOG.md` (see below)

## /todo — append to IMPROVEMENT_BACKLOG.md

When the user types `/todo <item>` — or asks in any phrasing to "add to TodoList / backlog / เพิ่มใน todo / จดไว้" — append the item to `IMPROVEMENT_BACKLOG.md` (NOT a session-only task list, so it survives across sessions).

Rules:
1. Append as a new `## <n>. <title>` section under the numbered list, continuing the existing numbering.
2. Always capture enough so it can be picked up cold later: include **ปัญหา** (why it matters), **ทำ** (what to do), **ไฟล์** (relevant files — go look them up in the repo, don't guess), and **เป้า** (done = what).
3. If the user only gives a one-liner, ask nothing — infer the files/intent from the codebase and fill the 4 fields yourself.
4. Keep the "ยังไม่เลือกทำ" section at the bottom; insert chosen items above it.
5. Confirm in one line: `✅ added to backlog → <title>`.

---

## CRITICAL: After every /analyze — Save JSON + Git Push

After generating any stock report, you MUST:

### Step 1 — Research before writing JSON

Before writing the JSON, fetch and verify:
- Live price, market cap, 52-week range
- Most recent earnings / catalyst outcome
- **catalystSpot**: search historical % moves for the same catalyst type in this sector (e.g. "NVDA earnings beat historical move %") — use real numbers, ห้าม fabricate
- **comparableCases**: find 2–3 real historical stocks that passed a similar event — use actual ticker, date, % move from search
- **rankChangeSource**: if verdict or score changed from last report, search for news that drove the change

### Step 2 — Save JSON to web/data/reports/

Save the report as JSON to:
`web/data/reports/<TICKER>_<YYYYMMDD>.json`

The JSON must follow this exact TypeScript type (StockReport in web/lib/types.ts):

```json
{
  "ticker": "NVDA",
  "companyName": "NVIDIA Corporation",
  "companyDescription": "AI GPU · Dominant H100/Blackwell AI training chips + CUDA ecosystem — picks & shovels of the AI era",
  "exchange": "NASDAQ",
  "generatedAt": "2026-06-20T00:00:00.000Z",
  "price": 131.38,
  "priceChange": 2.4,
  "priceNote": "Short note about price context",
  "marketCap": "$3.2T",
  "sector": "Technology / Semiconductors",
  "verdict": "BUY",
  "scoreLabel": "Core Holding",
  "score": 85,
  "summary": "English summary — 2-3 sentences thesis",
  "catalysts": [
    {
      "icon": "⚡",
      "name": "Catalyst Name",
      "description": "Description of catalyst",
      "urgencyLabel": "2 DAYS",
      "dateBadge": "Jun 20, 2026",
      "catalystDate": "2026-06-20",
      "badgeColor": "red",
      "dotColor": "yellow"
    }
  ],
  "risks": ["Risk 1", "Risk 2", "Risk 3"],
  "estimateDates": [
    { "event": "Earnings Q2", "dateRange": "Aug 27, 2026", "note": "Revenue ramp read", "est": "est. $140+", "highlight": "blue" }
  ],
  "scenarios": [
    { "label": "Bear", "color": "red", "pct": -20, "price": 105 },
    { "label": "Base", "color": "yellow", "pct": 14, "price": 150 },
    { "label": "Bull", "color": "green", "pct": 26, "price": 165 },
    { "label": "Moon", "color": "purple", "pct": 41, "price": 185 }
  ],
  "analystTargets": [
    { "firm": "Goldman Sachs", "target": 160, "rating": "Buy" }
  ],
  "macroRisk": {
    "fedRisk": "MEDIUM",
    "rateOutlook": "...",
    "inflationNote": "...",
    "sectorImpact": "...",
    "summary": "..."
  },
  "entryStrategy": {
    "entryLevels": [
      { "label": "Entry 1", "level": 131, "note": "Current price", "timing": "Now" },
      { "label": "Entry 2", "level": 120, "rangeMax": 125, "note": "Dip zone", "timing": "If dips", "preferred": true },
      { "label": "Entry 3", "level": 108, "note": "200-day MA", "timing": "Deep dip" }
    ],
    "tp1": { "price": 150, "pct": 14.2, "note": "Near-term target" },
    "tp2": { "price": 165, "pct": 25.6, "note": "Bull case" },
    "tp3": { "price": 185, "pct": 40.8, "note": "Moon case · 2027", "moon": true },
    "stopLoss": {
      "tight": 118, "tightPct": -10, "tightNote": "Below support",
      "hard": 102, "hardPct": -22, "hardNote": "200-day breach",
      "riskReward": "2.5 : 1", "rrNote": "Tight stop vs TP2", "rrWarning": "Good R/R"
    },
    "verdict": "One-line verdict in English",
    "approach": "DCA"
  },
  "catalystSpot": {
    "catalystType": "earnings_beat | satellite_launch | fda_decision | foundry_validation | delivery_beat | partnership_win",
    "preRunup": "อธิบาย pattern การวิ่งก่อน event โดยอ้างอิงจากประวัติ sector เดียวกัน",
    "preRunupTiming": "เช่น '1–2 สัปดาห์ก่อน event'",
    "preRunupPct": "เช่น '+8–15%'",
    "postWin": {
      "avgPct": 15,
      "range": "+10% to +24%",
      "note": "อ้างอิงตัวเลขจริงจากประวัติ — ห้าม fabricate",
      "exampleDate": "เช่น 'Dec 2024' หรือ 'Q3 FY24 · May 2024' — วันที่ตัวอย่างที่ดีที่สุดที่ใช้อ้างอิงใน note"
    },
    "postLose": {
      "avgPct": -12,
      "range": "-8% to -20%",
      "note": "อ้างอิงตัวเลขจริง เช่น กรณีที่ catalyst ล้มเหลวในอดีต",
      "exampleDate": "เช่น 'Aug 2022' — วันที่กรณีล้มเหลวที่ใช้อ้างอิง"
    },
    "spotSizing": {
      "pct": 5,
      "reason": "อธิบายว่าทำไม sizing เท่านี้ อ้างอิง conviction score + catalyst clarity"
    },
    "stopPreCatalyst": { "pct": -10, "price": 0, "note": "ระดับที่ถ้าหลุดแปลว่า thesis เปลี่ยน" },
    "stopPostCatalyst": { "pct": -15, "note": "ถ้า catalyst ออกมาแย่ ออกเมื่อไหร่" }
  },
  "comparableCases": [
    {
      "ticker": "TICKER",
      "event": "ชื่อ event เดิมที่เคยเกิดขึ้น",
      "date": "Mon YYYY",
      "movePct": 20,
      "days": 2,
      "outcome": "good",
      "note": "อธิบายว่าทำไม case นี้ comparable และ takeaway คืออะไร"
    }
  ],
  "rankChangeSource": {
    "headline": "ชื่อข่าวที่ทำให้ verdict/score เปลี่ยน (ถ้าหาได้จริง)",
    "url": "https://...",
    "date": "Mon YYYY"
  },
  "sources": ["https://..."],
  "i18n": {
    "th": {
      "summary": "สรุปภาษาไทย 2-3 ประโยค",
      "priceNote": "หมายเหตุราคา",
      "scoreLabel": "Core Holding / ค่าขนม / Speculative",
      "catalysts": [
        { "name": "ชื่อ catalyst ภาษาไทย", "description": "คำอธิบายภาษาไทย" }
      ],
      "risks": ["ความเสี่ยง 1", "ความเสี่ยง 2"],
      "macroRisk": {
        "rateOutlook": "...",
        "inflationNote": "...",
        "sectorImpact": "...",
        "summary": "..."
      },
      "entryStrategy": {
        "verdict": "บทสรุปภาษาไทย",
        "entryLevels": [
          { "note": "หมายเหตุภาษาไทย", "timing": "ตอนนี้" },
          { "note": "หมายเหตุภาษาไทย", "timing": "ถ้าย่อ" },
          { "note": "หมายเหตุภาษาไทย", "timing": "ถ้าร่วงหนัก" }
        ],
        "tp1": { "note": "หมายเหตุภาษาไทย" },
        "tp2": { "note": "หมายเหตุภาษาไทย" },
        "tp3": { "note": "หมายเหตุภาษาไทย" },
        "stopLoss": { "tightNote": "...", "hardNote": "...", "rrNote": "...", "rrWarning": "..." }
      },
      "estimateDates": [
        { "event": "ชื่อ event ภาษาไทย", "note": "หมายเหตุภาษาไทย" }
      ]
    }
  }
}
```

**verdict values:** `"BUY"` | `"HOLD"` | `"SELL"` | `"SPECULATIVE"`
**scoreLabel values:** `"Core Holding"` | `"Speculative"` | `"ค่าขนม"`
**dotColor values:** `"red"` | `"yellow"` | `"green"` | `"gray"`
**badgeColor values:** `"red"` | `"yellow"` | `"green"` | `"blue"`
**highlight values:** `"blue"` | `"yellow"`
**approach values:** `"DCA"` | `"Lump Sum"` | `"Scale In"`
**catalystType values:** `"earnings_beat"` | `"satellite_launch"` | `"fda_decision"` | `"foundry_validation"` | `"delivery_beat"` | `"partnership_win"` | `"product_launch"` | `"regulatory_approval"`
**outcome values:** `"good"` | `"mixed"` | `"bad"`

### Step 2 — Git commit and push

After saving the JSON, run:
```bash
cd /path/to/stock-radar-weekly
git add web/data/reports/
git commit -m "report: add <TICKER> report <YYYYMMDD>"
git push origin main
```

This triggers Vercel to redeploy the Next.js site automatically.

### Step 3 — Tell the user

Confirm with one line:
> "✅ <TICKER> report saved → pushed to GitHub → Vercel deploying"

---

## File naming convention
- JSON report: `web/data/reports/<TICKER>_<YYYYMMDD>.json`
- If a report for the same ticker already exists for today, overwrite it.
