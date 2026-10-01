#!/bin/bash
# Pushes Supabase env vars to Vercel. Secrets are read from your shell / .env.local — never hardcode them here.
#   Usage:  set -a; source .env.local; set +a; bash setup-env.sh
set -euo pipefail

: "${NEXT_PUBLIC_SUPABASE_URL:?Set NEXT_PUBLIC_SUPABASE_URL}"
: "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?Set NEXT_PUBLIC_SUPABASE_ANON_KEY}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY}"

export VERCEL_SCOPE="cashmereu3-5490s-projects"

for target in production preview development; do
  printf '%s' "$NEXT_PUBLIC_SUPABASE_URL"      | npx vercel env add NEXT_PUBLIC_SUPABASE_URL      "$target" --scope "$VERCEL_SCOPE"
  printf '%s' "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY "$target" --scope "$VERCEL_SCOPE"
  printf '%s' "$SUPABASE_SERVICE_ROLE_KEY"     | npx vercel env add SUPABASE_SERVICE_ROLE_KEY     "$target" --scope "$VERCEL_SCOPE"
done

echo "Redeploying to apply variables..."
npx vercel --prod --yes --scope "$VERCEL_SCOPE"
