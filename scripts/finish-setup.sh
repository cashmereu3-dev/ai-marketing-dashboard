#!/bin/bash
# One command to finish The Agency setup. Run from the project folder:  bash scripts/finish-setup.sh
# Keys are typed hidden, written only to .env.local (git-ignored), never printed or committed.
set -euo pipefail
cd "$(dirname "$0")/.."

URL="https://tyemvjyqtebbcmxfalun.supabase.co"
set_env() { # set_env NAME VALUE  (replace or append in .env.local)
  touch .env.local
  grep -v "^$1=" .env.local > .env.local.tmp || true
  printf '%s=%s\n' "$1" "$2" >> .env.local.tmp
  mv .env.local.tmp .env.local
}
ask() { # ask NAME PROMPT  (hidden input; Enter to skip)
  local v; read -r -s -p "$2 (Enter to skip): " v; echo
  [ -n "$v" ] && set_env "$1" "$v" && echo "  saved $1" || echo "  skipped $1"
}

echo "== The Agency setup =="
set_env NEXT_PUBLIC_SUPABASE_URL "$URL"; echo "  saved NEXT_PUBLIC_SUPABASE_URL"
echo "Supabase > Project Settings > API Keys > 'Legacy' tab:"
ask NEXT_PUBLIC_SUPABASE_ANON_KEY "Paste the anon key"
ask SUPABASE_SERVICE_ROLE_KEY "Paste the service_role key"
# Main phone alerts: ntfy. Make an unguessable topic once.
if ! grep -q '^NTFY_TOPIC=' .env.local 2>/dev/null; then
  set_env NTFY_TOPIC "agency-$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 16)"
fi
set_env AGENCY_PROVIDER auto
echo "AI keys:"
ask ANTHROPIC_API_KEY "Claude API key"
ask GEMINI_API_KEY "Google Gemini API key"
echo "Optional data keys:"
ask YOUTUBE_API_KEY "YouTube Data API key"
ask CLOUDINARY_CLOUD_NAME "Cloudinary cloud name"
ask FACEBOOK_PAGE_ID "Facebook Page ID"
ask FACEBOOK_PAGE_ACCESS_TOKEN "Facebook Page access token"
read -r -p "Your live site address (e.g. https://your-app.vercel.app): " APPURL; [ -n "$APPURL" ] && set_env NEXT_PUBLIC_APP_URL "${APPURL%/}"

echo; echo "== Push code to GitHub =="
git push origin main || echo "  Push failed - sign in to GitHub (git credential / gh auth login) and run: git push origin main"

echo; read -r -p "Push all keys in .env.local to Vercel now? (y/N) " yn
if [ "$yn" = "y" ]; then
  set -a; source .env.local; set +a
  bash setup-env.sh
fi
echo
echo "PHONE ALERTS (main): install the free ntfy app, tap +, subscribe to this topic:"
grep '^NTFY_TOPIC=' .env.local | cut -d= -f2
echo "Done."
