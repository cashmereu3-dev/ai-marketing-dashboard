#!/bin/bash
# Adds ONLY the phone-alert settings (Twilio SMS/WhatsApp), then redeploys. Keys typed hidden; saved to .env.local.
set -euo pipefail
cd "$(dirname "$0")/.."
set_env() { touch .env.local; grep -v "^$1=" .env.local > .env.local.tmp || true; printf '%s=%s\n' "$1" "$2" >> .env.local.tmp; mv .env.local.tmp .env.local; }
ask() { local v; read -r -s -p "$2 (Enter to skip): " v; echo; [ -n "$v" ] && set_env "$1" "$v" && echo "  saved $1" || echo "  skipped $1"; }
ask TWILIO_ACCOUNT_SID "Twilio Account SID (starts with AC)"
ask TWILIO_AUTH_TOKEN "Twilio Auth Token"
read -r -p "WhatsApp number [+16013413901]: " wa; set_env ALERT_WHATSAPP "${wa:-+16013413901}"
set_env NEXT_PUBLIC_APP_URL "https://the-agency-green.vercel.app"
echo "Deploying..."
set -a; source .env.local; set +a
bash setup-env.sh
echo "Done. Open the dashboard and tap Send test."
