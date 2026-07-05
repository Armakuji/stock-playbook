# ⬡ StockPlaybook

[![CI](https://github.com/Armakuji/stock-radar-weekly/actions/workflows/ci.yml/badge.svg)](https://github.com/Armakuji/stock-radar-weekly/actions/workflows/ci.yml)

Automated institutional-grade stock analysis pipeline — Claude researches → writes JSON reports → git push → the site redeploys. Plus a multi-user trade journal backed by its own API.

**Live:** [stock-radar-weekly.vercel.app](https://stock-radar-weekly.vercel.app)

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
├── scripts/    # Validation + backtest price fetcher
└── docs/       # Architecture & deployment guides (see docs/architecture/journal-api.md)
```

---

## Pages

| Page | What it shows |
|---|---|
| `/` | Landing — 4-element navigation (💧 DCA · 🌬️ Catalyst · 🔥 Turbo) + market-timing ticker |
| `/catalyst` | Top 5 catalyst plays (30%+ upside) ranked by catalyst proximity |
| `/dca` | Quality-core long-term picks — funds + stocks, quality/valuation scored |
| `/turbo` | Moonshot plays (300%+ speculative) ranked by bull-case upside |
| `/report/[ticker]` | Full report — entry strategy, scenarios, catalyst spot, timeline, simulator |
| `/backtest` | Verdict accuracy — forward returns + hit rate per verdict tier |
| `/journal` | Trade journal — Google login, your trades only (NestJS API + Postgres) |

---

## Slash commands

| Command | Description |
|---|---|
| `/analyze <TICKER>` | Single-stock report → JSON + push |
| `/catalyst-list` | 5 best catalyst plays + market-timing snapshot |
| `/turbo-list` · `/analyze-turbo <T>` | Moonshot list / single moonshot report |
| `/dca-list` · `/analyze-dca <T>` | Quality-core list / single DCA report |
| `/preview <TICKER>` | Dry-run report in chat — no save, no push |
| `/compare <T1> <T2>` · `/watchlist <T...>` | Comparison / quick scorecard |
| `/macro` | Standalone Fed/macro snapshot |
| `/todo <item>` | Append to `IMPROVEMENT_BACKLOG.md` |

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
- EDGAR/market tooling originally inspired by the MIT-licensed community skill `xvary-stock-research`, since rewritten

---

*Not financial advice · StockPlaybook Research*
