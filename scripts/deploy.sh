#!/usr/bin/env bash
# Commit current changes (no secrets; .env.local is git-ignored) and deploy to production.
set -e
cd "$(dirname "$0")/.."
bash scripts/sync-env.sh || true
git add -A
git -c user.name="Jevon Ashley" -c user.email="jvnashley@gmail.com" commit -m "Fix session handling, sign-out, alert test UI; add deploy scripts" || true
git push || true
npx vercel --prod --yes
