---
description: Validate open trades in private/journal.json vs current prices (hold/cut, stop check)
argument-hint: [TICKER]
---
Run journal validation for: **$ARGUMENTS** (or all open trades if no ticker). Load the `journal-validator` skill and follow it: read open trades in `private/journal.json`, fetch live prices, and answer (1) is the plan still valid (thesis intact, SL not breached) and (2) if tight stop hit — hold to hard stop or exit.
