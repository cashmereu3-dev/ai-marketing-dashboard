#!/usr/bin/env bash
# Saves your LinkedIn token (hidden prompt, never printed), finds your author ID from LinkedIn, saves both, syncs to Vercel.
cd "$(dirname "$0")/.."
read -rsp "Paste your LinkedIn access token, then Enter (nothing will show): " TOK; echo
TOK=$(printf '%s' "$TOK" | LC_ALL=C tr -cd '\041-\176')
[ ${#TOK} -gt 20 ] || { echo "That looks too short to be a LinkedIn token."; exit 1; }
SUB=$(curl -s -H "Authorization: Bearer $TOK" https://api.linkedin.com/v2/userinfo | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("sub",""))
except Exception: print("")')
if [ -z "$SUB" ]; then
  echo "LinkedIn did not accept that token for profile lookup (it needs the openid/profile scope, or it may be expired)."
  read -rp "If you know your LinkedIn member ID (the part after urn:li:person:), type it, else press Enter to stop: " SUB
  [ -n "$SUB" ] || exit 1
fi
python3 - "$TOK" "urn:li:person:$SUB" <<'PY'
import sys
lines=[l for l in open('.env.local') if not l.startswith(('LINKEDIN_ACCESS_TOKEN=','LINKEDIN_AUTHOR_URN='))]
lines+= ['LINKEDIN_ACCESS_TOKEN=%s\n'%sys.argv[1],'LINKEDIN_AUTHOR_URN=%s\n'%sys.argv[2]]
open('.env.local','w').write(''.join(lines))
PY
echo "Saved LinkedIn (member ${SUB:0:4}...). Syncing to Vercel..."
set -a; source .env.local; set +a
bash setup-env.sh
