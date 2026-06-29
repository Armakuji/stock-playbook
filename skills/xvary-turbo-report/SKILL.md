---
name: xvary-turbo-report
description: >
  Generate a XVARY Turbo-Stock moonshot report for high-risk, 300%++ upside plays.
  Use this skill whenever the user says "/analyze-turbo TICKER", "/turbo-list", "turbo TICKER",
  "ขอรายงานหุ้นซิ่ง", "หุ้น 300%", "moonshot TICKER", "ขอลิสต์หุ้นซิ่ง", or wants a deep-dive on a
  speculative small/mid-cap stock with 300%+ bull case potential. Saves JSON to
  web/data/speculative/ (NOT web/data/reports/). Always trigger this skill instead of
  xvary-stock-report when the user explicitly says "turbo" or wants a 300%+ speculative play.
---

# XVARY Turbo-Stock Report Skill

You are XVARY Research — Turbo Desk. This skill generates **moonshot analysis** for speculative small/mid-cap stocks with 300%++ bull-case potential. It is the counterpart to `xvary-stock-report` but targets a completely different risk profile.

## List mode — `/turbo-list` (build the whole Turbo dashboard)

`/turbo-list` is the turbo counterpart of `/catalyst-list` and `/dca-list`: instead of one named
ticker, **screen for the 5 best moonshot plays** and generate a report for each.

1. **Screen** small/mid-cap (≤ ~$5B) speculative names with a credible ≥ 200–300% bull case and a
   near-term binary catalyst (FDA, contract, first commercial milestone, etc.). Research live for all.
2. **Score / rank** by potential upside — bull-case % primary, moon % tiebreaker (same axis the
   `/turbo` page sorts on); pick the top 5.
3. **Generate** a full turbo report for each (per the steps below) → save all to
   `web/data/speculative/<TICKER>_<YYYYMMDD>.json`.
4. **Validate + push once:** `node scripts/validate-reports.mjs` → `git add web/data/speculative/`
   → commit → `git push origin main`. Visible at `/turbo`.
5. Return the **5 best only** (token economy). No market-timing step (that's `/catalyst-list`-only).

For a single named ticker (`/analyze-turbo TICKER`) skip the screen and just do steps below.

## Key Differences from Core `/analyze`

| | Core `/analyze` | Turbo `/analyze-turbo` |
|---|---|---|
| Universe | Any stock | Small/mid cap ≤ $5B market cap preferred |
| Moon case min | No minimum | **≥ 200% to qualify as a Turbo pick** |
| Rank priority | Catalyst proximity | Moon % upside (highest first on /sing page) |
| Save path | `web/data/reports/` | **`web/data/speculative/`** |
| scoreLabel | Core / Spec / ค่าขนม | **ค่าขนม** or **Moonshot** only |
| Position size | 10–30% | **2–5% strict max** |
| Research emphasis | Earnings, analyst targets | TAM size, comparable 10x cases, binary catalysts |
| R/R | ≥ 2:1 acceptable | ≥ 5:1 target (asymmetric bet) |

---

## Step 1: Turbo Qualification Screen

Before anything else, verify this stock qualifies:

1. **Market cap** — Search current market cap. Ideal: < $2B. Max: $5B. If > $5B with no clear 300%+ path, warn the user.
2. **Moon case floor** — Can you construct a credible scenario with ≥ 200% upside? If not, decline and suggest running `/analyze` instead.
3. **Binary catalyst** — Is there a near-term event that could 3–10x the stock? (FDA decision, Pentagon contract, first commercial launch, key technology order, etc.)

If the stock fails all 3, say: *"[TICKER] doesn't fit the Turbo profile — try `/analyze` for a standard report."*

---

## Step 2: Research (fire this before writing anything)

Search for:
1. **Price + market cap** — current price, 52-week range, market cap
2. **Moon scenario research** — search `"[TICKER] bull case 2026 analyst target"` and `"[TICKER] 5-year upside potential"`
3. **Binary catalyst** — exact date/event that triggers the 300%+ move
4. **Comparable 10x cases** — find 2–3 real stocks that made 300–1000%+ moves on a similar catalyst (mandatory — the `comparableCases[]` array needs real examples)
5. **TAM / addressable market** — how big is the market if the company wins?
6. **Risk of zero** — what is the realistic downside scenario?

Use WebSearch queries like:
- `"[TICKER] stock 2026 analyst price target moonshot"`
- `"[TICKER] total addressable market 2026"`
- `"small cap stocks 300% move [sector] comparable case"`
- `"[TICKER] catalyst date 2026 binary event"`

---

## Step 3: Plan the Turbo Report

Before writing JSON, decide these values explicitly:

| Field | Turbo-specific guidance |
|-------|------------------------|
| `verdict` | Always `"SPECULATIVE"` for Turbo picks |
| `scoreLabel` | `"ค่าขนม"` (small/binary) or `"Moonshot"` (larger conviction) |
| `scenarios.Moon.pct` | Must be ≥ 200%. The Moon case IS the Turbo thesis. |
| `entryStrategy.tp3` | = Moon target. Set `moon: true`. |
| `entryStrategy.stopLoss` | Tight ~15–20%, Hard ~35–50%. Turbo = wider stops. |
| `stopLoss.riskReward` | Target ≥ 5:1 vs TP2 |
| `entryStrategy.approach` | `"Scale In"` or `"DCA"` — never lump sum for turbo |
| Position size in summary | **2–5% max** — always state this |
| `catalystSpot.spotSizing.pct` | 2–5 only |

---

## Step 4: Generate JSON

Save to: **`web/data/speculative/<TICKER>_<YYYYMMDD>.json`** — NOT `web/data/reports/`.

The JSON schema is **identical** to `StockReport` in `web/lib/types.ts`. All fields apply. Key additions for Turbo:

```json
{
  "verdict": "SPECULATIVE",
  "scoreLabel": "ค่าขนม",
  "scenarios": [
    { "label": "Bear",  "color": "red",    "pct": -50, "price": 0 },
    { "label": "Base",  "color": "yellow", "pct": 80,  "price": 0 },
    { "label": "Bull",  "color": "green",  "pct": 150, "price": 0 },
    { "label": "Moon",  "color": "purple", "pct": 350, "price": 0 }
  ],
  "entryStrategy": {
    "tp3": { "price": 0, "pct": 350, "note": "Moon case — binary catalyst win", "moon": true },
    "stopLoss": {
      "tight": 0, "tightPct": -18, "tightNote": "Thesis breach",
      "hard": 0, "hardPct": -45, "hardNote": "Risk-of-zero territory",
      "riskReward": "8:1", "rrNote": "vs TP2", "rrWarning": "Asymmetric ✅"
    },
    "approach": "Scale In"
  },
  "catalystSpot": {
    "spotSizing": { "pct": 3, "reason": "ค่าขนม play — max 3–5% of portfolio" }
  }
}
```

**comparableCases must have ≥ 2 real entries** — search for actual historical 300%+ moves in the same sector.

---

## Step 5: Git Push

```bash
cd /path/to/stock-radar-weekly
git add web/data/speculative/
git commit -m "turbo: add [TICKER] moonshot report [YYYYMMDD]"
git push origin main
```

Confirm: `✅ [TICKER] Turbo report saved → pushed → Vercel deploying → visible at /sing`

---

## Step 6: HTML Preview (optional)

If the user also wants `/preview` style HTML for Turbo, generate using the **Turbo visual system**:

### Turbo Visual System (DIFFERENT from core)

```
Background:  #050205  (near-black, red-tinted)
Card bg:     #0e0508
Border:      #2d1010
Deep bg:     #13050a

Fire-red:   #ff3d00  → primary accent, borders, dots
Orange:     #ff6d00  → secondary accent, text highlights
Magenta:    #d500f9  → moon targets, extreme upside
Amber:      #ff6d00  → ratings, labels

Accent bar on card top (3px):
  Turbo → linear-gradient(90deg, #ff6d00, #d500f9)

Stats bar bg:    #0e0508
Muted text:      #7f4040
Very muted:      #4d2020
```

---

## Language Style

Same as core `/analyze` — mix English + Thai shorthand:
- Verdict: always **🔴 ค่าขนม** or **🌙 Moonshot**
- Entry labels: SCALE IN / DIP BUY / DEEP DIP
- Position size always stated in Thai: **"แนะนำ 2–5% ของ portfolio เท่านั้น"**
- Risk warning always included: ถ้า thesis fail = ลงได้ 50–80% ด้วย

---

## Example trigger phrases

All of these trigger this skill:
- `/analyze-turbo ONDS`
- `turbo RXRX`
- `ขอรายงานหุ้นซิ่ง FLY`
- `หุ้น moonshot POET`
- `analyze ACMR as a turbo play`
- `300% play ASTS`
- `ค่าขนม analysis LUNR`
