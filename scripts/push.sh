#!/bin/bash
# push.sh — safe one-command push for StockPlaybook
# Usage: bash push.sh "your commit message"
#        bash push.sh  (uses "update" as default message)

set -e
REPO="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO"

# Remove stale git lock if present
if [ -f .git/index.lock ]; then
  echo "🔓 Removing stale index.lock..."
  rm -f .git/index.lock
fi

MESSAGE="${1:-update}"
git add -A
git commit -m "$MESSAGE"
git push origin main
echo "✅ Pushed → Vercel deploying"
