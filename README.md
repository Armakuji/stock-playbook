# ⬡ Stock Playbook

[![CI](https://github.com/Armakuji/stock-playbook/actions/workflows/ci.yml/badge.svg)](https://github.com/Armakuji/stock-playbook/actions/workflows/ci.yml)

Automated institutional-grade stock analysis pipeline — Claude researches → writes JSON reports → git push → the site redeploys. Plus a multi-user trade journal backed by its own API.

**Live:** [stockplaybook.app](https://stockplaybook.app)

---

## How it works

```
Claude → /analyze TICKER → web/data/reports/<TICKER>_<YYYYMMDD>.json → git push → Vercel deploys
Browser → /journal → Next.js rewrite proxy → NestJS API (Railway) → PostgreSQL
```

Reports are **git-based** (write-once JSON, validated by `scripts/validate-reports.mjs`, history = audit trail). The journal is **API-based** (per-user private data behind Google login).

---

## Project structure

```
stock-radar-weekly/
├── web/        # Next.js site (Vercel) — dashboards, reports, backtest, journal UI
├── service/    # NestJS journal API (Railway) — Google OIDC, trades CRUD, PostgreSQL + Prisma
├── skills/     # Claude skill definitions — stock-report, turbo-report, dca-report, ฯลฯ
├── tools/      # Python fetchers (SEC EDGAR, market data) used during research
├── scripts/    # Report validator, live-price + backtest fetchers, skill-feedback builder
└── docs/       # Architecture & deployment guides (see docs/architecture/journal-api.md)
```

---

## Pages

| Page | What it shows |
|---|---|
| `/` | Landing — element navigation (💧 DCA · 🌬️ Catalyst · 🔥 Turbo) |
| *(every page)* | Market-timing ticker under the header — click to open the drawer: summary, if/then, entry window, macro numbers, week-by-week risk calendar |
| `/catalyst` | Catalyst plays (20%+ upside, catalyst dated within ~6 weeks) ranked by catalyst proximity · picks at/below their hard stop move to a 🛑 Stopped strip |
| `/dca` | Quality-core long-term picks — funds + stocks, quality/valuation scored |
| `/turbo` | Moonshot plays (300%+ speculative) — top 10 ranked by written base-case % · picks at/below their hard stop move to a 🛑 Stopped strip |
| `/report/[ticker]` | Full report — entry strategy, scenarios, catalyst spot, timeline, simulator |
| `/backtest` | Verdict accuracy — forward returns + hit rate per verdict tier |
| `/journal` | Trade journal — Google login, your trades only (NestJS API + Postgres) |

---

## Slash commands

| Command | Description |
|---|---|
| `/analyze <TICKER>` | Single-stock report → JSON + push |
| `/catalyst-list` | 5 best catalyst plays (20%+ upside, catalyst within ~6 weeks) + logs near-misses |
| `/turbo-list` · `/analyze-turbo <T>` | Moonshot list (ranked survival-first, same score as `turbo-compare`) / single moonshot report |
| `/dca-list` · `/analyze-dca <T>` | Quality-core list / single DCA report |
| `/preview <TICKER>` | Dry-run report in chat — no save, no push |
| `/compare <T1> <T2>` · `/watchlist <T...>` | Comparison / quick scorecard |
| `/macro` | Fed/macro snapshot — the **only** thing that refreshes `web/data/market-timing.json` |
| `/todo <item>` | Append to `IMPROVEMENT_BACKLOG.md` |

Skills without a slash command (triggered by phrasing): `catalyst-compare` / `turbo-compare` (rank existing picks for entry now), `catalyst-refresh` / `turbo-refresh` (rewrite stale picks on live prices), `analyze-journal`.

---

## Feedback loop (backtest → prior)

```
npm run prices:fetch     → web/data/live-prices.json        (live quotes; feeds the hard-stop filter + compare skills)
npm run backtest:fetch   → backtest-cache.json + path-cache.json → skill-feedback.json
```

- `skill-feedback.json` is the measured prior that `/catalyst-list`, `/turbo-list` and the report/compare skills read in Step 0 (hit rates, excess vs SPY, tier-2 laggards by catalyst type, entry timing, MAE, scenario calibration, near-miss counterfactual).
- **Freshness gate:** if `generatedAt` is more than 7 days old the commands re-run `backtest:fetch`; if it is still stale they print `⚠️ STALE PRIOR` and treat the prior as context only.
- **Stop-adjusted series:** a pick whose daily close hits `stopLoss.hard` before its target is booked as a loss at the stop (`stopOutRate`, `stopAdjHitRate`, `medianStopAdjEndPct`), alongside the unchanged hit rates.
- **Schedule:** a Claude desktop scheduled task (`stock-playbook-backtest-fetch`, daily 06:37) runs both fetches on this machine. It does not commit — the data files go in with the next list/refresh run.

```bash
cd web && npm run prices:fetch && npm run backtest:fetch
```

---

## Run locally

**Web** (reports read from `web/data/`):

```bash
cd web && npm install && npm run dev    # http://localhost:3000
```

**Journal API** (needs Docker for Postgres — see `docs/architecture/journal-api-deployment.md`):

```bash
cd service
docker compose up -d          # Postgres 16
cp .env.example .env          # fill SESSION_SECRET + Google OAuth creds
npx prisma migrate dev
npm run start:dev             # http://localhost:4000
```

---

## Deployment

- **Web** → Vercel, Root Directory = `web`, auto-deploy on push to `main`
- **API** → Railway, Root Directory = `service`, Pre-Deploy = `npx prisma migrate deploy`, Postgres in the same project
- Full runbook: `docs/architecture/journal-api-deployment.md`

---

## Conventions

- 🟢 BUY · 🟡 HOLD · 🔴 SELL · 🟣 SPECULATIVE — dark theme throughout
- Language: English + Thai shorthand (ค่าขนม, Core holding, Speculative)
- Report schema: `StockReport` in `web/lib/types.ts` · score is computed by `web/lib/scoring.ts`, never hand-set
- Validate before every push: `node scripts/validate-reports.mjs` (sourcing, scenario/TP math, price drift, fuzzy dates)
- Dates: exact day when known (`"Nov 22, 2026"` + `catalystDate`). Genuinely fuzzy windows take a `~` prefix (`"~Q4 2026"`) — an un-tilded `"Q4 2026"` parses to a phantom Nov 15, and the validator blocks it on reports generated from 2026-11-12. A `~` catalyst's `catalystDate` is read as the window end only.
- Text contrast: secondary text must clear WCAG AA (4.5:1) — the turbo theme uses a warm ramp (`#d8b3ab` body · `#b58780` notes · `#a8786f` labels), the rest of the site uses `--muted: #7c8aa0`
- EDGAR/market tooling originally inspired by the MIT-licensed community skill `xvary-stock-research`, since rewritten

---

*Not financial advice · Stock Playbook Research*
