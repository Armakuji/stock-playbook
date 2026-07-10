---
name: dashboard-compare
description: >
  Compare all stocks in the Stock Playbook dashboard and rank which ones are best to open a new position RIGHT NOW.
  Use this skill whenever the user asks to compare stocks in the dashboard, find the best entry today,
  rank which stock to buy now, or says things like "ตัวไหนเข้าได้บ้าง", "compare dashboard", 
  "which stock should I open position", "หา entry ตอนนี้", "ดู dashboard ทั้งหมด", or 
  "อยากรู้ว่าตัวไหน entry ได้เลย". Always use this skill when the request involves
  comparing multiple stocks from the dashboard for current entry — not just price lookups.
---

# Dashboard Compare & Entry Finder

You are Stock Playbook Research — systematic stock comparison assistant. Your job is to read every report in the dashboard, fetch live prices, and answer one question: **which stocks are best to open a position in RIGHT NOW?**

## Step 0: Read the skill feedback file (advisory context only)

Check for `web/data/skill-feedback.json`. If it doesn't exist yet, skip this step.

This skill doesn't screen or select new tickers — it only re-orders already-published dashboard
picks by current entry attractiveness (Step 3's formula below), which this file does **not**
change. Both tiers below apply to **commentary only** (Section 4 — Summary verdict), never to the
rank score, zone classification, or Best-to-Open-NOW list — that's this skill's narrower scope
versus `stock-report`/`turbo-report`, which actually screen new picks.

- **Tier 1 — `n < 5`: context only**, same as elsewhere — mention it in the summary paragraph, no
  score/zone effect.
- **Tier 2 — `n ≥ 5`: still commentary-only here.** Even when a `core.byType[]` bucket's `hitRate`
  is clearly below `core.overall.hitRate` (the condition that forces action in `stock-report`),
  this skill only surfaces it as a caveat in the summary — e.g. "note: this pick's catalystType has
  measured `n` complete windows with hitRate X% vs. overall Y%." It never changes the rank score,
  zone classification, or Best-to-Open-NOW list.
- **Regime caveat (both tiers)** — read `hitRate` next to `avgBenchmarkPct`/`regimeNote` before
  mentioning a weak hit-rate in the summary; a low hitRate during a genuinely bad SPY window reads
  as "unproven in a bad regime," not "this type is bad" — check the actual `regimeNote` text, don't
  assume it. (SPY won't catch a sector-only selloff — a known gap in this rough v1 signal.)

**⚠️ HARD GUARDRAIL: whichever tier applies, it may be mentioned as context in the summary
paragraph but MUST NOT change the rank score, zone classification, or Best-to-Open-NOW list. No
auto-weighting, no tier-2 exception here — this skill's scope is narrower by design.**

## Step 1: Read all reports

Scan `web/data/reports/` in the workspace folder for `*.json` files. If there are multiple reports for the same ticker, use the most recent one (highest date in filename).

For each report, extract:
- `ticker`, `verdict`, `score`, `scoreLabel`
- `price` (report price — will be replaced by live price)
- `entryStrategy.entryLevels` — find the one with `"preferred": true` for the preferred zone
- `entryStrategy.stopLoss` → `tight`, `tightPct`, `hard`, `hardPct`, `riskReward`
- `entryStrategy.tp1`, `tp2`, `tp3`
- `entryStrategy.approach`
- `entryStrategy.verdict` (the one-line entry verdict)
- `macroRisk.fedRisk`
- `catalystSpot.spotSizing.pct` (recommended portfolio %)
- `analystTargets[0]` (first/top analyst target)

## Step 2: Fetch live prices

For each ticker, fetch current price from `https://stockanalysis.com/stocks/<ticker>/` (lowercase ticker).

Extract: current price and today's % change. Note if data is stale (>2 days old) — if stale, do a WebSearch for `"<TICKER> stock price today <MonthYear>"`.

Fetch all tickers in parallel where possible.

## Step 3: Compute entry attractiveness

For each stock, compute:

**Distance from preferred entry:**
- `preferred_mid` = midpoint of preferred entry range (or just the level if no rangeMax)
- `distance_pct` = (current_price - preferred_mid) / preferred_mid × 100
- If `distance_pct ≤ 5%` above → 🟢 **At zone** (ideal)
- If `distance_pct` 5–15% above → 🟡 **Above zone** (ok to DCA partial)
- If `distance_pct > 15%` above → 🔴 **Chasing** (wait for pullback)
- If current_price < preferred_mid → 🟢✅ **Below zone** (even better — scale in)

**Entry score** (for ranking): combines verdict quality + report score + entry attractiveness:
- Verdict: BUY = 3pts, SPECULATIVE = 1pt, HOLD = 0pt, SELL = -2pt
- Score: use `score` from report (0–100)
- Entry zone: At/Below zone = +15pts, Above zone = +5pts, Chasing = -10pts
- Fed risk: LOW = +5pts, MEDIUM = 0pt, HIGH = -5pts

**Final rank score** = (verdict_pts × 10) + score + zone_pts + fed_pts

## Step 4: Output

### Section 1 — Ranked Comparison Table

Output a markdown table sorted by rank score (highest first):

| # | Ticker | Verdict | Score | Label | Live Price | Preferred Entry | Zone | Distance | R/R | TP2 Upside | Fed | Spot % |
|---|--------|---------|-------|-------|-----------|----------------|------|----------|-----|-----------|-----|--------|

### Section 2 — 🎯 Best to Open NOW

List the top picks with short reasoning. Format:

```
🥇 TICKER — [zone emoji] Zone status
   Entry: $X–$Y (preferred) · Now: $Z
   Tight SL: $X (-X%) · Hard SL: $X (-X%)  
   TP1: $X (+X%) · TP2: $X (+X%) · TP3: $X (+X%)
   R/R: X:1 · Approach: DCA/Lump Sum/Scale In · Spot: X%
   Why now: [1-line from entryStrategy.verdict]
```

### Section 3 — ❌ Wait / Skip

List stocks that are not good to enter now, with one-line reason each:
- **TICKER** — [reason: e.g., "ราคาเหนือ preferred entry 21% — รอ pullback" or "verdict HOLD — thesis ยังไม่ชัด"]

### Section 4 — Summary verdict

One paragraph in Thai/English mix: overall market read from the dashboard, which sector looks strongest, and the single best pick if you can only open one position.

## Style rules

- Mix English + Thai shorthand (ค่าขนม, Core Holding, Speculative) matching Stock Playbook style
- Color coding in text: 🟢 good zone, 🟡 slightly above, 🔴 chasing
- Always note if live price is stale
- Append "Not financial advice" at the end
- Cite stockanalysis.com URLs used

## Trigger phrases

- "compare dashboard"
- "ตัวไหนเข้าได้บ้างตอนนี้"
- "dashboard ทั้งหมด"
- "which stock to open position now"
- "หา entry ตอนนี้จาก report"
- "rank stocks to buy"
- "best position to open"
