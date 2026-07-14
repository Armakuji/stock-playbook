---
name: turbo-report
description: >
  Generate a Stock Playbook Turbo-Stock moonshot report for high-risk, 300%++ upside plays.
  Use this skill whenever the user says "/analyze-turbo TICKER", "/turbo-list", "turbo TICKER",
  "ขอรายงานหุ้นซิ่ง", "หุ้น 300%", "moonshot TICKER", "ขอลิสต์หุ้นซิ่ง", or wants a deep-dive on a
  speculative small/mid-cap stock with 300%+ bull case potential. Saves JSON to
  web/data/speculative/ (NOT web/data/reports/). Always trigger this skill instead of
  stock-report when the user explicitly says "turbo" or wants a 300%+ speculative play.
---

# Stock Playbook Turbo-Stock Report Skill

You are Stock Playbook Research — Turbo Desk. This skill generates **moonshot analysis** for speculative small/mid-cap stocks with 300%++ bull-case potential. It is the counterpart to `stock-report` but targets a completely different risk profile.

## Step 0: Read the skill feedback file (advisory prior — applies to BOTH modes below)

Before screening (`/turbo-list`) or qualifying a single ticker (`/analyze-turbo`), check for
`web/data/skill-feedback.json`. If it doesn't exist yet, skip this step.

If it exists, use it as an **advisory prior** — two tiers, both apply:

- **Tier 1 — `n < 5`: context only.** Mention it if relevant, but NEVER use it to include, exclude,
  or re-rank a pick. No auto-weighting.
- **Tier 2 — `n ≥ 5`: MUST be applied.** Turbo has no per-catalystType breakdown (only
  `turbo.overall`), so this tier applies at the whole-lane level, not per type: if
  `turbo.overall.n ≥ 5` and `hitRate` is low, that MUST visibly tighten sizing/conviction guidance
  across ALL picks this run (smaller `catalystSpot.spotSizing.pct`, tighter language on
  `stopPreCatalyst`) — and say so explicitly in your reasoning when it fires. If `n < 5`, say
  "prior read, n<5 — context only, no sizing change forced."
- **Regime caveat (both tiers) — read `hitRate` next to `avgBenchmarkPct`/`regimeNote`, never
  alone.** A low hitRate while `regimeNote` shows many windows with SPY down is "unproven in a bad
  regime," not "turbo doesn't work" — but check the actual `regimeNote` text each run, don't
  assume it. (SPY is a rough broad-market proxy — it won't catch a sector-only selloff; that's a
  known gap in this v1 signal, not a reason to ignore the number.)
- `turbo.overall.medianMAE` — reference when setting `catalystSpot.spotSizing.pct` and
  `stopPreCatalyst`: e.g. "measured median drawdown before a turbo hit was X% → don't set the
  pre-catalyst stop tighter than that, it just kills winners."
- `scenarioCalibration.optimismBiasBasePct` / `optimismBiasBullPct` — if calibration shows written
  Base/Bull scenarios have historically run hotter than what actually happened, temper the new
  Base/Bull `pct` accordingly (the Moon case itself is the thesis and stays as-is).
- `nearMissCounterfactual.turbo` — if present, shows whether past turbo top-5 cuts actually beat
  what got rejected; use as a sanity check on how strict the bar should be, not a hard cutoff.
- **Ranking is upside-first per the current spec** — base-case % primary, moon % tiebreaker (see
  List mode Step 2 below). Survival-first ranking is backlog #11 and not yet implemented. Feedback
  never re-orders the `/turbo-list` pick order (Tier 2 above affects sizing/conviction language,
  not rank); it only informs the sizing/stop notes you write into the report.

## List mode — `/turbo-list` (build the whole Turbo dashboard)

`/turbo-list` is the turbo counterpart of `/catalyst-list` and `/dca-list`: instead of one named
ticker, **screen for the 5 best moonshot plays** and generate a report for each.

1. **Screen** small/mid-cap (≤ ~$5B) speculative names with a credible ≥ 200–300% bull case and a
   near-term binary catalyst (FDA, contract, first commercial milestone, etc.). Research live for all.
2. **Score / rank** by most possible upside — base-case % primary, moon % tiebreaker (same axis the
   `/turbo` page sorts on); pick the top 5.
3. **Generate** a full turbo report for each (per the steps below) → save all to
   `web/data/speculative/<TICKER>_<YYYYMMDD>.json`.
4. **Validate + push once:** `node scripts/validate-reports.mjs` → `git add web/data/speculative/`
   → commit → `git push`. Report the actual branch pushed — if it's not `main`, say "pushed to
   `<branch>` — merge to main to deploy", never "Vercel deploying". Visible at `/turbo` once on `main`.
5. Return the **5 best only** (token economy). No market-timing step (that's `/catalyst-list`-only).

For a single named ticker (`/analyze-turbo TICKER`) skip the screen and just do steps below.

## Key Differences from Core `/analyze`

| | Core `/analyze` | Turbo `/analyze-turbo` |
|---|---|---|
| Universe | Any stock | Small/mid cap ≤ $5B market cap preferred |
| Moon case min | No minimum | **≥ 200% to qualify as a Turbo pick** |
| Rank priority | Catalyst proximity | Base-case % (most possible upside), moon % tiebreaker |
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
1. **Price + market cap** — read `web/data/live-prices.json` **first**: if the ticker is present and
   its `asOf` is **≤ 12 hours old**, use `prices[TICKER].price`/`changePct` as the authoritative
   current price/today's change % — no self-fetch needed (same convention `catalyst-compare/SKILL.md`
   and `stock-report/SKILL.md` use for their live-price step). If the ticker is missing from the
   cache or `asOf` is older than 12h, fetch it fresh via WebSearch as today and note in your
   reasoning that the price was self-fetched. Either way, still search live for the 52-week range
   and market cap — the cache only covers current price/change%.
2. **Moon scenario research** — search `"[TICKER] bull case 2026 analyst target"` and `"[TICKER] 5-year upside potential"`
3. **Binary catalyst** — exact date/event that triggers the 300%+ move
4. **Comparable 10x cases** — find 2–3 real stocks that made 300–1000%+ moves on a similar catalyst (mandatory — the `comparableCases[]` array needs real examples)
5. **TAM / addressable market** — how big is the market if the company wins?
6. **Risk of zero** — what is the realistic downside scenario?
7. **Survival check (cash runway + shelf/ATM)** — search `"[TICKER] cash runway burn rate 2026"` and
   `"[TICKER] shelf registration ATM offering"` (recent 10-Q / press release). If runway **< 12
   months** AND an active shelf/ATM exists → the report must carry a survival flag (see Step 3).

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
| `factorTags` | set explicitly from `ai_semi` / `ai_software` / `space_launch` / `quantum` / `ev_auto` / `long_duration_rate` / `single_customer` only when auto-derive (`web/lib/factors.ts`) would miss or mislabel this pick; otherwise omit and let it derive |
| `risks[0]` (survival flag) | If the Step 2 survival check trips (runway < 12 months **and** an active shelf/ATM), prepend a risk to `risks[]` starting with `"⚠️ SURVIVAL:"` followed by the runway/shelf findings (mirror it in `i18n.th.risks[0]`). This prefix is a convention `turbo-compare` greps for — do NOT add a new schema field to `web/lib/types.ts`. |

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
git push
```

Report the actual branch pushed. If it's not `main`, say "pushed to `<branch>` — merge to main to
deploy", never "Vercel deploying". Confirm: `✅ [TICKER] Turbo report saved → pushed → visible at /turbo`

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
