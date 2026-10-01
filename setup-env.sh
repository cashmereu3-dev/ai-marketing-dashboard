#!/bin/bash
# Pushes Supabase env vars to Vercel. Secrets are read from your shell / .env.local — never hardcode them here.
#   Usage:  set -a; source .env.local; set +a; bash setup-env.sh
# Strip invisible/non-ASCII characters that copy-paste can add to secrets
for v in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  export "$v=$(printf '%s' "${!v}" | LC_ALL=C tr -cd '\041-\176')"
done
set -euo pipefail

: "${NEXT_PUBLIC_SUPABASE_URL:?Set NEXT_PUBLIC_SUPABASE_URL}"
: "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?Set NEXT_PUBLIC_SUPABASE_ANON_KEY}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY}"

export VERCEL_SCOPE="${VERCEL_SCOPE:-}"  # leave empty to use your logged-in Vercel account

for target in production preview development; do
  printf '%s' "$NEXT_PUBLIC_SUPABASE_URL"      | npx vercel env add NEXT_PUBLIC_SUPABASE_URL      "$target" ${VERCEL_SCOPE:+--scope "$VERCEL_SCOPE"} --force
  printf '%s' "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY "$target" ${VERCEL_SCOPE:+--scope "$VERCEL_SCOPE"} --force
  printf '%s' "$SUPABASE_SERVICE_ROLE_KEY"     | npx vercel env add SUPABASE_SERVICE_ROLE_KEY     "$target" ${VERCEL_SCOPE:+--scope "$VERCEL_SCOPE"} --force
done

# Optional vars: pushed only when set in .env.local
for name in ANTHROPIC_API_KEY GEMINI_API_KEY AGENCY_PROVIDER AGENCY_GEMINI_MODEL NTFY_TOPIC NTFY_SERVER NTFY_TOKEN NEXT_PUBLIC_APP_URL NEXT_PUBLIC_VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT YOUTUBE_API_KEY FACEBOOK_PAGE_ID FACEBOOK_PAGE_ACCESS_TOKEN SPOTIFY_CLIENT_ID SPOTIFY_CLIENT_SECRET TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM ALERT_PHONE TWILIO_WHATSAPP_FROM ALERT_WHATSAPP CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET AGENCY_ALLOWED_EMAILS; do
  val="${!name:-}"
  [ -z "$val" ] && continue
  for target in production preview development; do
    printf '%s' "$val" | npx vercel env add "$name" "$target" ${VERCEL_SCOPE:+--scope "$VERCEL_SCOPE"} --force
  done
done

echo "Redeploying to apply variables..."
npx vercel --prod --yes ${VERCEL_SCOPE:+--scope "$VERCEL_SCOPE"}
