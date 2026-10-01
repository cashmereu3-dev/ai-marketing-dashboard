#!/usr/bin/env bash
# Stores the LinkedIn app credentials for one-click "Connect with LinkedIn". Secret is typed hidden, never printed.
set -e
cd "$(dirname "$0")/.."
id="78xk4sxzjj9azu"
echo "LinkedIn app Client ID: $id"
echo "Get the Primary Client Secret: linkedin.com/developers/apps/239050072/auth > eye icon > copy"
read -r -s -p "Paste Client Secret (hidden), Enter: " s; echo
s="$(printf '%s' "$s" | tr -d '[:space:]"'"'")"
[[ "$s" =~ ^[A-Za-z0-9_=-]{12,64}$ ]] || { echo "Secret doesn't look right. Nothing changed."; exit 1; }
grep -vE '^(LINKEDIN_CLIENT_ID|LINKEDIN_CLIENT_SECRET)=' .env.local > .env.tmp || true
printf 'LINKEDIN_CLIENT_ID=%s\nLINKEDIN_CLIENT_SECRET=%s\n' "$id" "$s" >> .env.tmp
cat .env.tmp > .env.local; rm -f .env.tmp
echo "Saved (not shown). Deploying..."
bash scripts/deploy.sh
