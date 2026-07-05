# StockPlaybook — Features

ภาพรวมความสามารถทั้งหมด (อัปเดต 2026-06-23 · branch `feature/improve`)
สถาปัตยกรรม: Next.js (App Router) + JSON reports ใน `web/data/reports/` · ดีไซน์ dark fintech · สองภาษา TH/EN

---

## หน้า / Views

| หน้า | path | มีอะไร |
|------|------|--------|
| **Dashboard** | `/` | การ์ดหุ้นจัดกลุ่มตาม **catalystType**, เรียงตาม catalyst proximity → conviction, stats strip, factor-correlation + event-cluster warnings, realized section (catalyst ผ่านแล้ว) |
| **Report detail** | `/report/<ticker>` | verdict, score + breakdown (expander), staleness banner, catalysts, scenarios, analyst targets, Fed/macro, entry strategy, catalyst spot, comparable cases, timeline |
| **Backtest** | `/backtest` | North Star metric, verdict calibration, near-miss log, checkpoint table, fetch-prices button |
| **Journal** (local-only) | `/journal` | open trades, P&L, win-rate, plan adherence (ไม่ deploy — private) |
| **Simulator** | `/report/<ticker>/simulator` | จำลอง position sizing |

## Slash commands
`/analyze <T>` · `/preview <T>` · `/dashboard` · `/compare <T1> <T2>` · `/watchlist <T...>` · `/macro` · `/todo <item>`

---

## Analytics engines

- **Reproducible score** (`web/lib/scoring.ts`) — คำนวณ deterministic จาก 6 grounded fields (verdict, analyst upside, scenario asymmetry, entry R/R, catalyst density, Fed risk) รวม 100 · recompute ตอน load · same inputs → same score · มี breakdown expander
- **Ranking** (`web/lib/ranking.ts`) — sort หลัก = catalyst proximity tier, รอง = conviction
- **Catalyst timing** (`web/lib/catalyst-timing.ts`) — `catalystDate` (ISO) → daysToCatalyst, timing tiers (≤3d/≤10d/≤21d/far), event-day clustering, report stage (pre/post/undated)
- **North Star** (`web/lib/north-star.ts`) — hit-rate "+30% ภายใน 14 วัน" + median MAE (max adverse excursion) แยกตาม catalystType · เก็บ price path รายวัน
- **Backtest** (`web/lib/backtest.ts`) — checkpoint 30/60/90 วัน, hit-rate by verdict, auto price-fetch loop
- **Near-miss log** (`web/lib/near-miss.ts`) — counterfactual ของ candidate ที่ไม่ติด top 5 → selection edge (กัน survivorship bias)
- **Factor-correlation** (`web/lib/factors.ts`) — tag-based (ai_semi, ai_software, space_launch, quantum, ev_auto, long_duration_rate) เตือน correlated risk ข้าม group
- **Cap-size tier** (`web/lib/market-cap.ts`) — parse marketCap → MEGA/LARGE/MID/SMALL badge

## Data integrity / guardrails

- **Anti-fabrication validator** (`scripts/validate-reports.mjs`) — block push ถ้า report ไม่มี source / comparableCases ไม่มีหลักฐาน / catalystSpot ไม่มี exampleDate
- **Reproducible score** — เลขไม่ได้ใส่มือ, คำนวณจาก field ที่ grounded
- **Stage pre/post** — auto-archive ตัวที่ catalyst ผ่านแล้ว (ไม่ลบ — เก็บไว้ backtest)
- Macro/Fed section บังคับทุก report · sources ทุก report · bilingual TH/EN · "Not financial advice"

## Tooling / scripts

- `scripts/fetch-backtest-prices.mjs` — ดึงราคา checkpoint (30/60/90) + path 14 วัน + near-miss outcomes → caches  (`npm run backtest:fetch`)
- `scripts/validate-reports.mjs` — sourcing guardrail  (`npm run validate`)
- `scripts/push-report.sh` — git add/commit/push + guardrail gate
- `analyze-journal` skill — validate open trades vs live price (hold/cut analysis + add-more call), persists to `private/journal-validation.json`

---

## ค้างไว้ (backlog · ดู IMPROVEMENT_BACKLOG.md)
- ตั้ง schedule `backtest:fetch` รายเช้า (Mac mini)
- Earned category ranking + expectancy-based sizing *(รอ North Star สะสม sample)*
- Portfolio correlation view · Price-trigger alerts · Small-cap quota

_Not financial advice · StockPlaybook Research_
