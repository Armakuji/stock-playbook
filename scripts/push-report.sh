#!/bin/bash
# push-report.sh — called by Claude after saving a new JSON report
# Usage: ./scripts/push-report.sh NVDA 20260620

TICKER=${1:-"REPORT"}
DATE=${2:-$(date +%Y%m%d)}

cd "$(dirname "$0")/.." || exit 1

# ── Anti-fabrication guardrail — block push if a report is unsourced ──────────
if command -v node >/dev/null 2>&1; then
  node scripts/validate-reports.mjs || { echo "🛑 push aborted by sourcing guardrail"; exit 1; }
fi

git add web/data/reports/
git commit -m "report: add ${TICKER} report ${DATE}"
git push origin main

echo "✅ ${TICKER} report pushed → Vercel deploying"
