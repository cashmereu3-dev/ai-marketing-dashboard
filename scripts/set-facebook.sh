#!/bin/bash
# Paste ANY Graph Explorer token (user or Page). Finds the Visions4U Page token, checks it, saves it, redeploys. Never prints tokens.
set -uo pipefail
cd "$(dirname "$0")/.."
set_env() { touch .env.local; grep -v "^$1=" .env.local > .env.local.tmp || true; printf '%s=%s\n' "$1" "$2" >> .env.local.tmp; mv .env.local.tmp .env.local; }
read -r -s -p "Paste the Facebook access token: " T; echo
[ -z "$T" ] && { echo "Nothing pasted."; exit 1; }
set -a; source .env.local; set +a
G="https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION:-v23.0}"
WANT="${FACEBOOK_PAGE_ID:-254778307729932}"
export T WANT G
RESULT=$(python3 - <<'PY'
import os, json, urllib.request, urllib.parse
T=os.environ["T"]; WANT=os.environ["WANT"]; G=os.environ["G"]
def get(path, **q):
    q["access_token"]=T
    try:
        with urllib.request.urlopen(f"{G}/{path}?"+urllib.parse.urlencode(q)) as r: return json.load(r)
    except urllib.error.HTTPError as e:
        try: return json.load(e)
        except Exception: return {"error":{"message":f"HTTP {e.code}"}}
# 1) try as a user token: list Pages with their tokens
acc=get("me/accounts", fields="id,name,access_token")
pages=acc.get("data") or []
if pages:
    pick=next((p for p in pages if p["id"]==WANT), pages[0])
    print(json.dumps({"ok":True,"id":pick["id"],"name":pick["name"],"token":pick["access_token"]}))
else:
    # 2) maybe it already is a Page token
    me=get("me", fields="id,name,category")
    if me.get("category"):
        print(json.dumps({"ok":True,"id":me["id"],"name":me["name"],"token":T}))
    else:
        msg=(acc.get("error") or me.get("error") or {}).get("message","This token cannot see any Pages.")
        print(json.dumps({"ok":False,"msg":msg}))
PY
)
OK=$(echo "$RESULT" | python3 -c 'import sys,json;print(json.load(sys.stdin)["ok"])')
if [ "$OK" != "True" ]; then
  echo "Could not get a Page token: $(echo "$RESULT" | python3 -c 'import sys,json;print(json.load(sys.stdin)["msg"])')"
  exit 1
fi
PID=$(echo "$RESULT" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
PNAME=$(echo "$RESULT" | python3 -c 'import sys,json;print(json.load(sys.stdin)["name"])')
PTOK=$(echo "$RESULT" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
echo "Found Page: $PNAME (ID $PID)"
set_env FACEBOOK_PAGE_ACCESS_TOKEN "$PTOK"; set_env FACEBOOK_PAGE_ID "$PID"
set -a; source .env.local; set +a
bash setup-env.sh
