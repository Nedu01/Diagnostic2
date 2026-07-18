-- Applied once per database, by hand: paste into the Neon SQL editor
-- (or run: psql "$DATABASE_URL" -f db/schema.sql).

create table if not exists events (
  id bigserial primary key,
  happened_at timestamptz not null default now(),
  visitor_id uuid not null,
  name text not null,
  props jsonb not null default '{}'::jsonb
);
create index if not exists events_name_time on events (name, happened_at);
create index if not exists events_visitor on events (visitor_id);

-- Fixed-window rate limiting shared by /api/events and /api/admin/login.
-- key examples: 'events:<hashed ip>', 'login:<hashed ip>'.
create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null
);
