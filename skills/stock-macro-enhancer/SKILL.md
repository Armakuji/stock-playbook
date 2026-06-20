---
name: stock-macro-enhancer
description: >
  Use this skill whenever analyzing stocks or generating a stock report and you need to add:
  (1) Fed/macro risk analysis — interest rate risk, jobs data, inflation, rate hike probability,
  and how they affect the specific stock or sector being analyzed.
  (2) Entry strategy — DCA vs lump sum, timing relative to catalyst, position sizing,
  and stop-loss / take-profit levels.
  Trigger when: user asks to "add Fed risk", "add entry strategy", "add macro analysis",
  "enhance the report", or when a stock report is missing these two sections.
  Always add both sections together — Fed risk and entry strategy are paired outputs.
---

# Stock Macro Enhancer Skill

This skill adds two missing sections to any stock analysis report:
1. **Fed / Macro Risk Analysis**
2. **Entry Strategy**

---

## Section 1 — Fed / Macro Risk Analysis

For every stock being analyzed, research and add the following:

### 1.1 Interest Rate Sensitivity
- Is this stock **rate-sensitive**? (growth/tech = high sensitivity, utilities/energy = medium, value = low)
- Current Fed funds rate and next FOMC meeting date
- Market-implied probability of rate hike vs cut (use CME FedWatch if available)
- How does a +25bps hike affect this stock's valuation? (use rough DCF logic: higher discount rate = lower growth stock value)

### 1.2 Macro Indicators to Watch
List the top 3 macro data points that could move this stock before the catalyst date:
- Jobs report (Non-Farm Payrolls) — date and expected impact
- CPI/inflation print — date and expected impact
- Fed speeches / FOMC minutes — any scheduled before catalyst

### 1.3 Sector-Specific Macro Risk
- **AI/Tech**: Rate hike fears → growth stocks reprice lower; strong jobs = bad for rate-sensitive names
- **Energy/Utilities**: Rate hike = higher cost of capital; oil price = geopolitical wildcard
- **Biotech**: Less rate-sensitive; more binary catalyst driven; but risk-off environment hurts small caps
- **Defense**: War escalation = tailwind; ceasefire = headwind; rate-insensitive

### 1.4 Fed Risk Verdict
Provide a one-line verdict:
- 🟢 LOW FED RISK — catalyst is binary/clinical, not macro-driven
- 🟡 MEDIUM FED RISK — rate sensitive but catalyst may override macro
- 🔴 HIGH FED RISK — growth stock, no near-term binary catalyst, fully macro exposed

---

## Section 2 — Entry Strategy

For every stock, provide a structured entry plan:

### 2.1 Entry Type
Choose one and explain why:
- **Lump sum** — if catalyst is imminent (< 7 days) and conviction is high
- **DCA / Split entry** — if catalyst is 2–4 weeks away or macro uncertainty is high
- **Wait for pullback** — if stock already ran hard (>30% YTD) and no immediate catalyst

### 2.2 Entry Levels
Provide 3 price levels:
- **Aggressive entry** — current price or slight premium (FOMO entry)
- **Base entry** — 3–7% below current (on any dip)
- **Strong entry** — 10–15% below current (if macro selloff occurs)

### 2.3 Position Sizing
Based on risk profile:
- **ค่าขนม / lottery** — max 2–5% of portfolio, full loss acceptable
- **Speculative** — max 5–10% of portfolio
- **Core holding** — up to 15–20% of portfolio

### 2.4 Take Profit Levels
- **TP1** — +15 to +20% (trim 30–50% of position)
- **TP2** — +30% (trim another 30%)
- **TP3** — analyst price target (let remaining ride)

### 2.5 Stop Loss
- **Options**: full loss at expiry = natural stop; consider selling at -50% of premium if thesis breaks
- **Spot/shares**: -10 to -15% stop loss for speculative; no stop for long-term holds

### 2.6 Entry Strategy Verdict
One-line summary:
> Example: "DCA in 2 tranches — 50% now, 50% if dips below $X before June 24 earnings"

---

## Output Format

Add these two sections to the existing HTML report as new cards or table rows.
Match the existing visual style (dark theme, color coding, badges).

Use this color coding for Fed Risk:
- 🟢 = `color: #10b981` (green)
- 🟡 = `color: #f59e0b` (yellow/amber)
- 🔴 = `color: #ef4444` (red)

For Entry Strategy, use a structured card with:
- Entry type badge
- 3-row price table (Aggressive / Base / Strong)
- TP1 / TP2 / TP3 levels
- Stop loss note
- One-line verdict in bold

---

## Example Prompt Enhancement

When user provides a stock list like:
> "Analyze MU, RKLB, HCKT for +30% in 30 days"

Enhance the prompt to:
> "Analyze MU, RKLB, HCKT for +30% in 30 days.
> For EACH stock, add:
> (1) Fed/Macro Risk section: rate sensitivity, upcoming macro events before catalyst,
>     sector-specific macro risk, and Fed Risk verdict (LOW/MEDIUM/HIGH).
> (2) Entry Strategy section: lump sum vs DCA recommendation,
>     3 entry price levels (aggressive/base/strong),
>     position sizing (ค่าขนม / speculative / core),
>     TP1/TP2/TP3 take profit levels,
>     stop loss guidance,
>     and one-line entry verdict.
> Output as HTML dark theme report matching XVARY Research style."

---

## Notes
- Always check FOMC calendar and upcoming CPI/jobs dates before writing Fed risk section
- For options plays: entry strategy = which expiry, which strike, max premium to pay
- For spot/shares: entry strategy = DCA schedule and price levels
- Fed risk section should always reference the **specific stock's beta and sector** not generic advice
- If the report already has macro analysis, enhance it — don't duplicate
