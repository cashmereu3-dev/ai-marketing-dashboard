#!/usr/bin/env bash
# Adds one test Facebook draft to the approval queue (key is read from .env.local, never printed).
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
K=$(printf '%s' "$SUPABASE_SERVICE_ROLE_KEY" | LC_ALL=C tr -cd '\041-\176')
curl -sS -o /dev/null -w "HTTP %{http_code}\n" -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/agency_approval_queue" \
  -H "apikey: $K" -H "Authorization: Bearer $K" -H "Content-Type: application/json" \
  -d '{"brand":"visions4u","platform":"facebook","kind":"post","title":"Test post","content":"Testing the new approval system. Please ignore.","agent_id":"manual-test"}'
