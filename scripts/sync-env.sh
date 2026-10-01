#!/usr/bin/env bash
# Non-interactive: pushes only the optional integration vars that exist in .env.local to Vercel production.
# Values are piped, never prompted for or printed. Supabase variables are NOT touched.
cd "$(dirname "$0")/.."
[ -f .env.local ] || exit 0
for name in CRON_SECRET LINKEDIN_ACCESS_TOKEN LINKEDIN_CLIENT_ID LINKEDIN_CLIENT_SECRET OPEN_LLM_API_KEY OPEN_LLM_BASE_URL OPEN_LLM_MODEL ANTHROPIC_API_KEY AGENCY_PROVIDER NEXT_PUBLIC_APP_URL MUSIC_API_BASE_URL NEXT_PUBLIC_GA_MEASUREMENT_ID; do
  val=$(grep -m1 "^$name=" .env.local | cut -d= -f2- | LC_ALL=C tr -cd '\041-\176')
  [ -z "$val" ] && continue
  printf '%s' "$val" | npx vercel env add "$name" production --force >/dev/null 2>&1 && echo "synced $name" || echo "could not sync $name"
done
