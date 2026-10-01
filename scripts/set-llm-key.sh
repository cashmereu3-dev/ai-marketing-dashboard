#!/usr/bin/env bash
# Sets the AI key safely (hidden input, validated shape, never printed), then redeploys.
# Usage: bash scripts/set-llm-key.sh   (choose 1 = Anthropic, 2 = free Groq open model)
set -e
cd "$(dirname "$0")/.."
echo "1) Anthropic Claude key (starts sk-ant-)   2) Free Groq key (starts gsk_, console.groq.com/keys)"
read -r -p "Choose 1 or 2: " c
read -r -s -p "Paste key (hidden), Enter: " k; echo
k="$(printf '%s' "$k" | tr -d '[:space:]"'"'")"
if [ "$c" = "1" ]; then name=ANTHROPIC_API_KEY; [[ "$k" =~ ^sk-ant-[A-Za-z0-9_-]{60,}$ ]] || { echo "That doesn't look like a full Anthropic key (too short). Nothing changed."; exit 1; }
else name=OPEN_LLM_API_KEY; [[ "$k" =~ ^gsk_[A-Za-z0-9]{40,}$ ]] || { echo "That doesn't look like a full Groq key. Nothing changed."; exit 1; }; fi
grep -v "^$name=" .env.local > .env.tmp || true
printf '%s=%s\n' "$name" "$k" >> .env.tmp; cat .env.tmp > .env.local; rm -f .env.tmp
echo "Saved $name (not shown). Deploying..."
bash scripts/deploy.sh
