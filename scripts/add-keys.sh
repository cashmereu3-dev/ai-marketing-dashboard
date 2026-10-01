#!/usr/bin/env bash
# Saves a real Anthropic API key (hidden prompt), then redeploys. Nothing is printed or committed.
cd "$(dirname "$0")/.."
read -rsp "Paste your Anthropic API key (starts with sk-ant-), then Enter: " KEY; echo
KEY=$(printf '%s' "$KEY" | LC_ALL=C tr -cd '\041-\176')
case "$KEY" in sk-ant-*) ;; *) echo "That doesn't look like an Anthropic key (should start with sk-ant-)."; exit 1;; esac
python3 - "$KEY" <<'PY'
import sys
lines=[l for l in open('.env.local') if not l.startswith('ANTHROPIC_API_KEY=')]
lines.append('ANTHROPIC_API_KEY=%s\n'%sys.argv[1])
open('.env.local','w').write(''.join(lines))
PY
set -a; source .env.local; set +a
bash setup-env.sh
