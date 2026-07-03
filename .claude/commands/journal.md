---
description: Validate open trades in private/journal.json vs current prices (hold/cut, stop check, add-more call)
argument-hint: [TICKER]
---
Run journal validation for: **$ARGUMENTS** (or all open trades if no ticker). Load the `analyze-journal` skill and follow it: read open trades in `private/journal.json`, fetch live prices, and answer (1) is the plan still valid, (2) if tight stop hit — hold to hard stop or exit, and (3) should you add more right now (buy the dip / wait / don't add, with a specific reason). Always ends with `private/journal-validation.json` saved so `/journal` stays in sync.
