#!/usr/bin/env bash
# One run: sets the AI key + LinkedIn app secret (hidden input, validated, never printed), then deploys once.
set -e
cd "$(dirname "$0")/.."
put() { grep -vE "^$1=" .env.local > .env.tmp || true; printf '%s=%s\n' "$1" "$2" >> .env.tmp; cat .env.tmp > .env.local; rm -f .env.tmp; }
clean() { printf '%s' "$1" | tr -d '[:space:]"'"'"; }
echo "== AI key =="; echo "1) Anthropic (sk-ant-...)  2) Free Groq (gsk_..., console.groq.com/keys)  Enter = skip"
read -r -p "Choose: " c
if [ "$c" = "1" ] || [ "$c" = "2" ]; then
  read -r -s -p "Paste key (hidden): " k; echo; k="$(clean "$k")"
  if [ "$c" = "1" ]; then [[ "$k" =~ ^sk-ant-[A-Za-z0-9_-]{60,}$ ]] || { echo "Not a full Anthropic key. Aborted, nothing changed."; exit 1; }; put ANTHROPIC_API_KEY "$k"
  else [[ "$k" =~ ^gsk_[A-Za-z0-9]{40,}$ ]] || { echo "Not a full Groq key. Aborted, nothing changed."; exit 1; }; put OPEN_LLM_API_KEY "$k"; fi
fi
echo "== LinkedIn app secret (linkedin.com/developers/apps/239050072/auth > eye icon > copy) =="
read -r -s -p "Paste Client Secret (hidden, Enter = skip): " s; echo; s="$(clean "$s")"
if [ -n "$s" ]; then
  [[ "$s" =~ ^[A-Za-z0-9_.=+/-]{12,200}$ ]] || { echo "Secret doesn't look right. Aborted."; exit 1; }
  put LINKEDIN_CLIENT_ID 78xk4sxzjj9azu; put LINKEDIN_CLIENT_SECRET "$s"
fi
echo "Saved (values not shown). Deploying..."
bash scripts/deploy.sh
