#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
set -a; source .env.local; set +a
bash setup-env.sh   # re-pushes cleaned env vars and deploys to production
git add -A
git -c user.name="Jevon Ashley" -c user.email="jvnashley@gmail.com" commit -m "Strip stray non-ASCII chars from Supabase keys" || true
git push || true
