-- The Agency: approval queue
-- Agents DRAFT work and put it here; nothing is published until Jevon approves it.
-- Run this once in the Supabase SQL editor for the dashboard project.

create table if not exists public.agency_approval_queue (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'published')),
  brand text not null check (brand in ('visions4u', 'build_catalyst', 'silverfoxx2u')),
  platform text not null check (platform in ('facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'email', 'sms', 'website', 'other')),
  kind text not null default 'post',
  title text not null,
  content text not null,
  media_url text,
  scheduled_for timestamptz,
  rationale text,
  agent_id text not null,
  project_id text,
  decision_note text
);

create index if not exists agency_approval_queue_status_idx
  on public.agency_approval_queue (status, created_at desc);

-- RLS on with NO policies: the browser (anon key) cannot read or write this table.
-- Only the server, using the service-role key, can.
alter table public.agency_approval_queue enable row level security;

-- Phone notifications: one row per device that turned on notifications.
create table if not exists public.agency_push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_email text,
  created_at timestamptz not null default now()
);

-- RLS on with NO policies: only the server (service-role key) can read or write.
alter table public.agency_push_subscriptions enable row level security;
