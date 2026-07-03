---
name: analyze-journal
description: >
  Validate open trades in private/journal.json against current market prices and persist results to private/journal-validation.json so the /journal page stays in sync. Use this skill when the user asks "journal เป็นยังไง", "แผนยัง OK ไหม", "check trade", "ถึง stop ไหม", "should I hold or cut", "validate journal", "analyze journal", "/journal", "/analyze-journal <TICKER>", or when asking whether a trade plan is still valid. Also triggers when user says "AVGO/ASTS ถึง stop" or any trade-specific plan check. Always use this skill for trade validation — not just price lookups.
---

# Analyze Journal Skill

You are XVARY Research — systematic trade validation assistant. Your job is to read open trades, fetch live prices, and answer three questions:
1. **Is the plan still valid?** (thesis intact, SL not breached)
2. **If tight stop was hit — hold to hard stop or exit?**
3. **Should you add more right now?** (buy the dip / wait / don't add — with a specific reason)

Then persist the results to `private/journal-validation.json` so the `/journal` page on the site reflects this run — every invocation of this skill ends with that file updated, not just chat output.

## Mode detection

Check `$ARGUMENTS`:
- **If a TICKER is provided** (e.g. `/analyze-journal AVGO`) → **Single-ticker mode**: analyze only that ticker
- **If empty** (e.g. `/analyze-journal`, `/journal`, or a natural-language trigger) → **All-tickers mode**: analyze every unique open ticker

---

## Step 1 — Read the journal

Read `private/journal.json` from the workspace folder. This file is **PRIVATE — never commit to git, never deploy**.

If the file is not found, stop immediately and tell the user:
> "ไม่พบ `private/journal.json` — กรุณา **Select Folder** และเลือก `stock-radar-weekly` ก่อน แล้วลองใหม่"

Do NOT attempt to create the file or guess its location.

Expected schema:
```json
{
  "trades": [
    {
      "ticker": "ASTS",
      "entryPrice": 79.26,
      "shares": 3.8,
      "entryDate": "2026-06-18",
      "plannedTP": [97, 115, 150],
      "plannedSL": 68,
      "status": "open",
      "exits": []
    }
  ]
}
```

### Auto-close guard (data consistency check)

Before filtering, scan every trade regardless of `status`. If a trade has `status: "open"` but `sum(exits[].shares) >= shares`, the position is fully exited — the status is a data inconsistency. **Treat it as closed**: skip it from validation, do not fetch a price for it, and show a one-line note:

> `⚠️ <TICKER> (entry <date>) — all shares exited but status="open". Treating as closed. Update status in journal.`

This prevents phantom open-position errors in P&L and exposure calculations.

Filter for `"status": "open"` trades only (after the guard above), then extract unique tickers.

**Single-ticker mode:** Confirm the given ticker exists as an open position. If not found, stop and say:
> "`<TICKER>` ไม่มีใน open positions — ตรวจสอบ journal อีกครั้ง"

---

## Step 2 — Fetch live prices

For each open trade, fetch current price using source priority:

**Source 1:** `mcp__workspace__web_fetch` → `https://stockanalysis.com/stocks/<TICKER>/`
- Fresh if date shows today
- Stale if date is >2 days old — try Source 2

**Source 2:** WebSearch → `"<TICKER> stock price today <MonthYear>"`

Extract: current price, previous close, today's % change. If the market is closed (weekend/holiday), use the last confirmed close and say so explicitly.

---

## Step 3 — Analyze each trade

For each trade, compute and report:

```
Ticker:     ASTS
Entry:      $79.26 (Jun 18)
Current:    $79.10  →  -0.2% from entry
────────────────────────────────────
TP1: $97    → needs +22.7%  🔵 not reached
TP2: $115   → needs +45.1%  🔵 not reached
TP3: $150   → needs +89.4%  🔵 not reached
SL:  $68    → buffer $11.10 (14.0%)  🟢 safe
────────────────────────────────────
Plan valid: ✅ / ⚠️ / ❌
```

**Plan status logic:**
- ✅ **Valid** — price above entry, SL buffer >8%, no thesis-breaking news
- ⚠️ **Watch** — price near entry or SL buffer <8%, or sector headwinds today
- ❌ **Breached** — price at or below tight SL → trigger Step 5

---

## Step 4 — Should You Add More?

For **every** open position — regardless of Plan status — give an explicit answer to the question the trader actually has: *"should I put more money into this right now?"* This is separate from the HOLD/WATCH/CUT action; a position can be a clean HOLD and still be a "don't add more" (e.g. a dated binary catalyst is close).

**Three possible answers — pick exactly one per position:**

| Answer | When to use |
|--------|-------------|
| 🟢 **Buy more on dip** | Plan status is ✅ Valid, no dated binary catalyst (earnings, PDUFA/FDA, contract decision) inside ~3 weeks, and there's a sensible lower entry zone (recent support / prior accumulation range) that still offers good R/R to TP1+ |
| 🟡 **Wait** | Thesis is intact, but a dated binary catalyst lands within ~3 weeks — adding before the event risks a gap against you. Re-open the recommendation after the event clears (or on a confirmed post-event dip) |
| 🔴 **Don't buy more** | Plan status is ⚠️ Watch or ❌ Breached, OR price is already extended well above a sensible add zone (poor R/R to add here), OR the position is already at its intended max conviction size |

**Always give a one-line reason tied to the specific fact driving it** — the exact catalyst name + date, the SL buffer %, the extension % from entry, etc. Never a generic "for risk management" reason with no specifics:

- ✅ "Wait — RXRX Q2 earnings Aug 11, binary gap risk, re-assess after"
- ✅ "Don't add — AVGO SL buffer down to 6.7% on sector selloff, not company-specific"
- ✅ "Buy more on dip — ONDS thesis intact, no catalyst for 6 weeks, $6.90-7.20 is the last support zone"
- ❌ "Wait — need to manage risk" (no specific fact — not acceptable)

If a position has **both** a Watch-level concern **and** an upcoming catalyst, lead with whichever blocks adding — the answer is still just "Don't buy more" or "Wait," pick the one whose condition would need to clear first.

---

## Step 5 — Tight Stop Reached — Hold or Cut?

Only run this section if current price ≤ plannedSL.

Analyze these 5 factors and score each GREEN / YELLOW / RED:

| Factor | Check | Weight |
|--------|-------|--------|
| **Market context** | Is broader market (SPY/QQQ) also down today, or is this stock-specific? | 2x |
| **Catalyst status** | Is the original catalyst still upcoming and intact? | 2x |
| **Volume** | Is today's volume unusually high (panic) or normal (noise)? | 1x |
| **Sector** | Is the whole sector selling off (systemic) or just this ticker? | 1x |
| **News** | Any new fundamental negative news (not just price action)? | 2x |

**Decision rule:**
- 4–5 GREEN → Consider holding to **hard stop** (structural level, typically 15–22% below entry). Reduce size by 50%.
- 2–3 GREEN → **Cut at tight stop**. Wait for re-entry on confirmation.
- 0–1 GREEN → **Exit immediately**. Thesis likely broken.

Always output:
```
🛑 TIGHT STOP HIT: <TICKER> @ $<price>
Decision: HOLD TO HARD STOP / CUT NOW / EXIT IMMEDIATELY
Hard stop level: $<price> (<pct>% from entry)
Reason: <2-sentence reasoning>
Re-entry signal: <what price action or news would confirm safe re-entry>
```

---

## Step 6 — Chat output format

For each open trade, output a card:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 <TICKER> — <verdict emoji> <status>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Entry $X.XX · <date> · <N> shares
Now   $X.XX  (<+/->X.X% from entry)

TP1 $X  → needs +X%   [hit ✅ / pending 🔵]
TP2 $X  → needs +X%   [hit ✅ / pending 🔵]
TP3 $X  → needs +X%   [hit ✅ / pending 🔵]

SL  $X  → buffer $X.XX (X.X%)  [🟢/🟡/🔴]

Thesis: [still intact / weakened / broken]
Action: [HOLD / WATCH / CUT / EXIT]
Add more: [Buy the Dip 🟢 / Wait 🟡 / Don't Add 🔴] — <one-line reason tied to a specific fact>
Note: <1-2 sentence context — news, sector, catalyst status>
```

After all cards, append a **Summary table**:

| Ticker | Entry | Now | P&L | SL Buffer | Status | Add More? |
|--------|-------|-----|-----|-----------|--------|-----------|
| ASTS   | $79.26 | $79.10 | -0.2% | 14% | 🟢 Hold | 🟡 Wait — earnings Aug 15 |
| AVGO   | $389.55 | $396.30 | +1.7% | 4.1% | 🟡 Watch | 🔴 Don't add — SL buffer thin |

---

## Step 7 — Save validation results (always, every run)

Read existing `private/journal-validation.json` if it exists — **merge** the new results into it (do NOT overwrite results for tickers not analyzed this session, relevant in single-ticker mode). Update `generatedAt` to now.

```json
{
  "_note": "Journal validator results — generated by the analyze-journal skill (via /journal or /analyze-journal). Local only, never committed to git.",
  "generatedAt": "<ISO timestamp>",
  "results": {
    "AVGO": {
      "verdict": "WATCH",
      "thesisIntact": true,
      "stopBreached": false,
      "atRisk": false,
      "summary": "1-2 sentence status, including the Add More fact",
      "action": "One-line HOLD/CUT recommendation, followed by the Add More call and its specific reason — e.g. 'Hold through Sep 3 earnings. Don't add — SL buffer thin (7.97%) on sector-wide selloff.'",
      "color": "yellow"
    }
  }
}
```

This file is read by the web journal page at `/journal` to show the validator section on each open trade. **This step is not optional** — every run of this skill, whether triggered by `/journal`, `/analyze-journal`, or a natural-language trigger phrase, ends with this file updated. There is no "chat-only" mode.

---

## Step 8 — Confirm

Show a one-line summary per analyzed ticker:

| Ticker | Verdict | Entry | Now | vs SL | vs TP1 | Add More? |
|--------|---------|-------|-----|-------|--------|-----------|

Then remind which tickers remain if in single-ticker mode:
> "✅ AVGO done · ยังเหลือ: RXRX, FLY, ONDS — รัน `/analyze-journal RXRX` ใน session ถัดไป"

> Not financial advice.

---

## Always-on rules

- Never commit or push `private/journal.json` or `private/journal-validation.json` — both are local Mac Mini only
- Always fetch live price before analysis — never use stale research price
- If market is closed (weekend/holiday), use last confirmed close and note it
- Thesis validity is qualitative — search for recent news if needed
- **This skill does NOT refresh `web/data/reports/` (or speculative/dca) research reports, and does NOT commit or push anything to git.** It is a read-only price/thesis check against the journal. If a report needs a fresh full re-analysis, that's a separate `/analyze` call, not part of this skill.
- **Every open position gets an "Add more?" call** (Step 4) — never skip it, and never give it without a specific reason (a date, a %, a level). If you don't have enough information to pin down a reason, that itself is a reason to say "Wait."
- **Always end by saving `private/journal-validation.json`** (Step 7) — this skill has no standalone "just talk, don't persist" mode. If the user only asked a quick question about one ticker, still update that ticker's entry in the file.
- Output in Thai/English mix matching XVARY style
- Append "Not financial advice" at the end

## Trigger phrases

- "/journal"
- "/analyze-journal"
- "/analyze-journal <TICKER>"
- "analyze journal"
- "journal เป็นยังไง"
- "แผนยัง OK ไหม"
- "ถึง tight stop แล้ว ควร hold ไหม"
- "check ASTS / AVGO position"
- "AVGO แตะ 380 แล้ว ทำยังไงดี"
- "should I cut or hold"
- "validate journal"
