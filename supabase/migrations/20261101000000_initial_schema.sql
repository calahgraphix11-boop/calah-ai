-- November Command Centre: personal goals, finance, projects and trading journal.
-- Every user-owned table is protected by RLS. The trade journal bucket is private.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  base_currency text not null default 'XAF' check (base_currency in ('USD','XAF','EUR')),
  xaf_per_usd numeric(14,4) not null default 600,
  eur_to_usd numeric(14,6) not null default 1.08,
  monthly_profit_target_usd numeric(14,2) not null default 5000,
  timezone text not null default 'Africa/Douala',
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  accent text not null default 'gold' check (accent in ('gold','violet','blue','mint','rose')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source text not null default 'Other',
  category text not null default 'Other',
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'XAF' check (currency in ('USD','XAF','EUR')),
  amount_usd numeric(14,2) not null default 0,
  status text not null default 'collected' check (status in ('collected','pending','refunded')),
  received_on date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.expense_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'Other',
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'XAF' check (currency in ('USD','XAF','EUR')),
  amount_usd numeric(14,2) not null default 0,
  spent_on date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  area text not null default 'Personal',
  target numeric(14,2) not null default 1,
  current numeric(14,2) not null default 0,
  unit text not null default 'steps',
  due_date date,
  status text not null default 'active' check (status in ('active','paused','completed')),
  accent text not null default 'gold',
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  area text not null default 'Personal',
  due_date date not null default current_date,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null default '',
  area text not null default 'Business',
  status text not null default 'active' check (status in ('active','testing','paused','completed')),
  target_label text not null default '',
  target numeric(14,2) not null default 0,
  current numeric(14,2) not null default 0,
  accent text not null default 'gold',
  created_at timestamptz not null default now(),
  unique(user_id, slug)
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument text not null,
  direction text not null check (direction in ('buy','sell')),
  setup text not null default '',
  result text not null default 'open' check (result in ('win','loss','breakeven','open')),
  pnl numeric(14,2) not null default 0,
  currency text not null default 'USD' check (currency in ('USD','XAF','EUR')),
  pnl_usd numeric(14,2) not null default 0,
  risk_percent numeric(6,3),
  reward_risk numeric(8,3),
  entry_price numeric(20,8),
  exit_price numeric(20,8),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text not null default '',
  screenshots text[] not null default '{}',
  created_at timestamptz not null default now()
);

do $$
declare
  tbl text;
begin
  foreach tbl in array array['profiles','income_entries','expense_entries','goals','tasks','projects','trades']
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_select_own', tbl);
    execute format('create policy %I on public.%I for select to authenticated using (id = (select auth.uid()))', tbl || '_select_own', tbl);
  end loop;
end $$;

-- Profiles use id as the owner key; other tables use user_id.
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists income_entries_insert_own on public.income_entries;
create policy income_entries_insert_own on public.income_entries for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists income_entries_update_own on public.income_entries;
create policy income_entries_update_own on public.income_entries for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists income_entries_delete_own on public.income_entries;
create policy income_entries_delete_own on public.income_entries for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists expense_entries_insert_own on public.expense_entries;
create policy expense_entries_insert_own on public.expense_entries for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists expense_entries_update_own on public.expense_entries;
create policy expense_entries_update_own on public.expense_entries for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists expense_entries_delete_own on public.expense_entries;
create policy expense_entries_delete_own on public.expense_entries for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists goals_insert_own on public.goals;
create policy goals_insert_own on public.goals for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists goals_update_own on public.goals;
create policy goals_update_own on public.goals for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists goals_delete_own on public.goals;
create policy goals_delete_own on public.goals for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own on public.tasks for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own on public.tasks for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own on public.tasks for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists trades_insert_own on public.trades;
create policy trades_insert_own on public.trades for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists trades_update_own on public.trades;
create policy trades_update_own on public.trades for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists trades_delete_own on public.trades;
create policy trades_delete_own on public.trades for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on all tables in schema public to authenticated;

-- Private attachment bucket; each user's files live under their auth UID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trade-journal', 'trade-journal', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists trade_journal_read_own on storage.objects;
create policy trade_journal_read_own on storage.objects for select to authenticated
using (bucket_id = 'trade-journal' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists trade_journal_upload_own on storage.objects;
create policy trade_journal_upload_own on storage.objects for insert to authenticated
with check (bucket_id = 'trade-journal' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists trade_journal_delete_own on storage.objects;
create policy trade_journal_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'trade-journal' and (storage.foldername(name))[1] = (select auth.uid()::text));
