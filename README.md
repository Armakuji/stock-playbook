# ⬡ XVARY Research — Stock Radar Weekly

Automated institutional-grade stock analysis pipeline. Generates weekly reports → saves as JSON → pushes to GitHub → triggers Vercel deployment.

---

## How it works

```
Claude (scheduled) → /analyze TICKER → JSON report → git push → Vercel deploys updated site
```

1. A scheduled task runs `/analyze TICKER` in Claude
2. The report is saved to `web/data/reports/<TICKER>_<YYYYMMDD>.json`
3. Git commits and pushes automatically
4. Vercel detects the push and redeploys the Next.js site

---

## Project structure

```
stock-radar-weekly/
├── web/                        # Next.js site (deploy root for Vercel)
│   ├── app/
│   │   ├── layout.tsx          # XVARY header + footer
│   │   ├── page.tsx            # Dashboard — all stock cards
│   │   ├── StockCard.tsx       # Client component for card hover
│   │   └── report/[ticker]/
│   │       └── page.tsx        # Individual report page
│   ├── lib/
│   │   ├── types.ts            # StockReport TypeScript type
│   │   └── reports.ts          # Reads JSON reports from disk
│   └── data/reports/           # JSON report files (auto-generated)
│       └── NVDA_20260612.json
├── skills/                     # Claude skill definitions
├── prompts/                    # Claude prompt templates
└── CLAUDE.md                   # Claude persona + slash commands
```

---

## Features

- **Weekly Watchlist** — Dashboard of all tracked stocks ranked by conviction (verdict, Fed risk, score, upside). Each card shows price, score ring, price-to-target bar, and Fed risk at a glance.
- **Ranking Change** — Table showing how each stock's rank shifted vs the previous report snapshot, with auto-generated reason (verdict change, score shift, upside movement).
- **Stock Report Detail** — Full single-stock deep-dive with catalyst timeline, bear/base/bull/moon scenarios, analyst targets, Fed/macro risk verdict, and 3-level entry strategy with TP1/TP2/TP3 and stop loss. Supports EN/TH toggle.

---

## Slash commands

| Command | Description |
|---|---|
| `/analyze <TICKER>` | Full single-stock report → saves JSON + HTML |
| `/dashboard` | Find 5 stocks with 30%+ upside → save watchlist |
| `/compare <T1> <T2>` | Side-by-side comparison |
| `/watchlist <T1> <T2> ...` | Quick scorecard table |
| `/macro` | Standalone Fed/macro snapshot |

---

## Report JSON schema

Each report in `web/data/reports/` follows the `StockReport` type in `web/lib/types.ts`:

- `ticker`, `companyName`, `sector`, `price`, `priceChange`
- `verdict` — `BUY | HOLD | SELL | SPECULATIVE`
- `summary` — 2–3 sentence thesis
- `catalysts[]` — upside drivers
- `risks[]` — downside factors
- `macroRisk` — Fed risk verdict (`LOW | MEDIUM | HIGH`) + rate/inflation notes
- `entryStrategy` — 3 entry levels, TP1/TP2/TP3, stop loss, one-line verdict
- `analystTargets[]` — firm, rating, price target
- `sources[]` — URLs cited in research

---

## Run locally

```bash
# IMPORTANT: run from inside the web/ folder, not the repo root
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Reports are read from `web/data/reports/` — add JSON files there to see them on the dashboard.

---

## Vercel deployment

1. Connect this repo to Vercel
2. Set **Root Directory** → `web`
3. Framework: **Next.js** (auto-detected)
4. Every `git push` to `main` triggers a redeploy

---

## Report style

- Dark theme · XVARY Research visual system
- 🟢 `#10b981` BUY · 🟡 `#f59e0b` HOLD · 🔴 `#ef4444` SELL · 🟣 `#8b5cf6` SPECULATIVE
- Language: English + Thai shorthand (ค่าขนม, Core holding, Speculative)

---

*Not financial advice · XVARY Research*
