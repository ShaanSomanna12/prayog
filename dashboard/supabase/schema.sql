-- ─────────────────────────────────────────────────────────────────────────────
-- Watch Guard — Supabase schema for Realtime fleet events
--
-- Run this once in the Supabase SQL editor (or via supabase db push).
-- The Node.js backend can INSERT rows here via the Supabase JS client, which
-- triggers the Realtime broadcast to all connected dashboards.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Events table -----------------------------------------------------------------

create table if not exists public.machine_events (
  id               bigserial primary key,
  camera_id        text        not null,
  machine_name     text,
  machine_type     text        default '3d_printer',
  timestamp        timestamptz not null default now(),

  -- Status
  machine_status        text not null,
  machine_status_reason text,
  status                text,
  status_confidence     numeric(4,3),

  -- Failure detail
  failure_type   text,
  failure_box    jsonb,          -- { x, y, width, height }
  confidence     numeric(4,3),
  severity       smallint,
  reason         text,
  evidence       text,
  probable_cause text,
  next_step      text,

  -- Visual evidence
  snapshot          text,         -- base64 data URL (keep short or use Storage)
  detected_colors   jsonb,        -- [{name, hex, confidence, coverage}]

  -- Confirmation streak
  confirmation_streak  smallint,
  confirmation_target  smallint,
  confirmed_failure    boolean default false,
  newly_confirmed      boolean default false,
  newly_recovered      boolean default false
);

-- Keep only the last 7 days of events to control table size
create index if not exists machine_events_camera_ts
  on public.machine_events (camera_id, timestamp desc);

-- RLS: allow authenticated users & the anon key to SELECT (read-only dashboard)
alter table public.machine_events enable row level security;

create policy "Allow read" on public.machine_events
  for select using (true);

create policy "Allow service insert" on public.machine_events
  for insert with check (true);

-- 2. Enable Realtime on the table --------------------------------------------------

-- This tells Supabase Realtime to stream INSERT/UPDATE events for this table.
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime for all tables;
commit;

-- Or, to only publish machine_events:
-- alter publication supabase_realtime add table public.machine_events;


-- 3. Auto-cleanup: delete events older than 7 days ---------------------------------

create or replace function public.cleanup_old_machine_events()
returns void language sql as $$
  delete from public.machine_events
  where timestamp < now() - interval '7 days';
$$;

-- Schedule with pg_cron (Supabase supports this):
-- select cron.schedule('cleanup-machine-events', '0 3 * * *', 'select cleanup_old_machine_events()');

