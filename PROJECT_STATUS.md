# StockPlaybook Research · Project Status

**Last updated:** 2026-06-20
**Workspace:** `stock-radar-weekly/`

---

## Who I Am

StockPlaybook Research — institutional-grade stock analysis assistant.
- Dark-theme HTML reports · Color: 🟢 #10b981 · 🟡 #f59e0b · 🔴 #ef4444
- Language mix: English + Thai shorthand (ค่าขนม / Speculative / Core holding)
- Every report: research first → Fed risk (LOW/MED/HIGH) → 3 entry levels + TP1/TP2/TP3 + Stop Loss
- Disclaimer always: "Not financial advice · StockPlaybook Research"

---

## Current Portfolio (as of June 18)

| Ticker | Status | Notes |
|--------|--------|-------|
| **AVGO** | ✅ In portfolio | Broadcom — AI networking/chip play |
| **ASTS** | ✅ In portfolio | AST SpaceMobile — satellite broadband |
| **MU** | 👀 Watch only | Sold. Watch MU earnings Jun 24 — may re-enter after result |

---

## Reports Generated

| File | Date | Ticker | Key Verdict |
|------|------|--------|-------------|
| `NVDA_report_20260612.html` | Jun 12 | NVDA | 🟡 Speculative → Core runner. Entry DCA: $205 / $192 / $178. TP3 $298. Aug 26 earnings catalyst. Fed risk: MEDIUM |
| `watchlist_20260615.html` | Jun 15 | AVGO, ASTS + others | Quick scorecard dashboard |
| `watchlist_20260615_v2.html` | Jun 15 | AVGO, ASTS | Updated v2 scorecard |
| `entry_AVGO_ASTS_20260615.html` | Jun 15 | AVGO + ASTS | Entry strategy comparison |
| `Stock Radar_full_report_20260615.html` | Jun 15 | AVGO + ASTS | Full dual report |
| `watchlist_20260618.html` | Jun 18 | INTC, AMAT, AMD | Watchlist — recommended deploy order: AMD → INTC → AMAT |
| `INTC_report_20260618.html` | Jun 18 | INTC | 🟡 Speculative. **DO NOT CHASE at $128–130.** Wait pullback to $110–115. Catalyst: Apple chip deal (Trump Jun 18) + earnings Jul 23 |

---

## Key Decisions & Context

### INTC — Intel (Most Recent, Jun 18)
- **Catalyst:** Apple selected Intel to produce some A-series chips (announced by Trump, Jun 18) + Agentic AI CPU wave + BofA raised target to $135
- **Warning:** Stock surged +10% in one day to ~$128–130, near ATH $132.75. **Chasing here is bad R/R.**
- **Entry target:** $110–115 on pullback. R/R = 2.5:1
- **Verdict:** Speculative. Wait for the dip.
- **Upcoming catalyst:** Earnings Jul 23

### NVDA — NVIDIA (Jun 12)
- Entry: DCA ⅓ at $205 → $192 → $178
- TP1 / TP2 / TP3: escalating toward $298 (analyst consensus)
- Fed risk: MEDIUM (high-multiple semi, sensitive to CPI Jul 14)
- Earnings: Aug 26

### AMAT — Applied Materials
- Surged +10% week of Jun 18 from analyst target $650 + Singapore AI build-out
- Watch only — no full report yet

### Deployment Priority (as of Jun 18 watchlist)
> **AMD → INTC → AMAT** (if deploying remaining powder/cash)

---

## Slash Commands (Quick Reference)

| Command | What it does |
|---------|-------------|
| `/dashboard` | Find 5 new stocks with 30%+ upside — saves `watchlist_YYYYMMDD.html` |
| `/analyze <TICKER>` | Full single-stock HTML report (price + news + Fed risk + entry) |
| `/compare <T1> <T2>` | Side-by-side comparison |
| `/watchlist <T1> <T2>...` | Quick scorecard table |
| `/macro` | Standalone Fed/macro snapshot |

---

## Upcoming Dates to Watch

| Date | Event |
|------|-------|
| Jun 24 | **MU earnings** — watch for re-entry signal |
| Jul 14 | **CPI print** — affects high-multiple semis (NVDA, AMAT) |
| Jul 23 | **INTC earnings** — main catalyst trigger |
| Aug 26 | **NVDA earnings** — hold-to target event |

---

## Files & Folders

```
stock-radar-weekly/
├── CLAUDE.md              ← StockPlaybook Research persona + rules (auto-loaded)
├── PROJECT_STATUS.md      ← This file — read first when starting a new session
├── prompts/
│   └── daily_dashboard.md ← Template for /dashboard command
├── skills/                ← Skill definitions
└── *.html                 ← All generated reports
```

---

*Not financial advice · StockPlaybook Research*
