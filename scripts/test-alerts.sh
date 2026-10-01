#!/bin/bash
# Sends a test WhatsApp (and ntfy) using .env.local. Prints only status, never keys.
cd "$(dirname "$0")/.."
set -a; source .env.local; set +a
FROM="${TWILIO_WHATSAPP_FROM:-whatsapp:+14155238886}"
code=$(curl -s -o /tmp/tw.json -w "%{http_code}" -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
  --data-urlencode "To=whatsapp:$ALERT_WHATSAPP" --data-urlencode "From=$FROM" \
  --data-urlencode "Body=The Agency: WhatsApp alerts are working.")
echo "WhatsApp via Twilio -> HTTP $code"
python3 -c "import json;d=json.load(open('/tmp/tw.json'));print(d.get('status') or d.get('message'), d.get('code') or '')" 2>/dev/null
rm -f /tmp/tw.json
[ -n "$NTFY_TOPIC" ] && echo "ntfy -> HTTP $(curl -s -o /dev/null -w '%{http_code}' -H 'Title: The Agency' -d 'ntfy alerts are working.' https://ntfy.sh/$NTFY_TOPIC)"
