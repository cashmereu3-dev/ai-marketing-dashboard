#!/usr/bin/env bash
# Commit current changes (no secrets; .env.local is git-ignored) and deploy to production.
set -e
if grep -qE '^(NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)=("?)(gsk_|sk-ant-)' .env.local 2>/dev/null; then echo "ERROR: a Supabase variable in .env.local holds a non-Supabase key. Aborting."; exit 1; fi
cd "$(dirname "$0")/.."
bash scripts/sync-env.sh || true
pgrep -x git >/dev/null || rm -f .git/index.lock .git/HEAD.lock .git/refs/heads/*.lock
git add -A
git -c user.name="Jevon Ashley" -c user.email="jvnashley@gmail.com" commit -m "Fix session handling, sign-out, alert test UI; add deploy scripts" || true
git push || true
npx vercel --prod --yes
