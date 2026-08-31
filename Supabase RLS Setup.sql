-- Run this in the Supabase SQL Editor for the Bebum Snack Bar prototype.
-- User metadata must contain: {"role":"keeper"}, {"role":"tender"}, or {"role":"manager"}.

create table if not exists public.daily_records (
  trading_date date primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_catalog (
  id integer primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '');
$$;

alter table public.daily_records enable row level security;
alter table public.app_catalog enable row level security;

drop policy if exists "authenticated users can read daily records" on public.daily_records;
create policy "authenticated users can read daily records"
on public.daily_records for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "authenticated users can create daily records" on public.daily_records;
create policy "authenticated users can create daily records"
on public.daily_records for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "authenticated users can update daily records" on public.daily_records;
create policy "authenticated users can update daily records"
on public.daily_records for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "authenticated users can read catalog" on public.app_catalog;
create policy "authenticated users can read catalog"
on public.app_catalog for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "store roles can create catalog" on public.app_catalog;
create policy "store roles can create catalog"
on public.app_catalog for insert
to authenticated
with check (public.current_app_role() in ('keeper', 'manager'));

drop policy if exists "store roles can update catalog" on public.app_catalog;
create policy "store roles can update catalog"
on public.app_catalog for update
to authenticated
using (public.current_app_role() in ('keeper', 'manager'))
with check (public.current_app_role() in ('keeper', 'manager'));

-- No delete policy is intentionally provided.
-- The app archives drinks instead of deleting historical data.
