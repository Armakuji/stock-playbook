#!/bin/bash
# push-report.sh — called by Claude after saving a new JSON report
# Usage: ./scripts/push-report.sh NVDA 20260620

TICKER=${1:-"REPORT"}
DATE=${2:-$(date +%Y%m%d)}

cd "$(dirname "$0")/.." || exit 1

git add web/data/reports/
git commit -m "report: add ${TICKER} report ${DATE}"
git push origin main

echo "✅ ${TICKER} report pushed → Vercel deploying"
