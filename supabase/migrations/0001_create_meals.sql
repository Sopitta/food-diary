create extension if not exists pgcrypto;

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  photo_url text,
  description text,
  calories integer,
  protein numeric,
  carbs numeric,
  fat numeric,
  created_at timestamptz not null default now(),
  constraint meals_has_content check (photo_url is not null or description is not null)
);

create index meals_created_at_idx on public.meals (created_at desc);

alter table public.meals enable row level security;
alter table public.meals force row level security;

-- Intentionally no policies: with RLS enabled and no policies, the anon and
-- authenticated roles are denied all access by default. Only the
-- service_role key (server-only, never sent to the browser) bypasses RLS,
-- so every read/write goes through Next.js API routes. When multi-user auth
-- is added later, this table can grow user-scoped policies without any
-- change to today's server-side access pattern.

-- Supabase's default privileges only grant TRUNCATE/REFERENCES/TRIGGER/MAINTAIN
-- to anon/authenticated/service_role on new tables - base CRUD grants must be
-- added explicitly. We grant them only to service_role (which also bypasses
-- RLS), leaving anon/authenticated with no table access at all.
grant select, insert, update, delete on public.meals to service_role;
