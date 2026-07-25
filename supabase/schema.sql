create extension if not exists pgcrypto;

-- ─── USERS ──────────────────────────────────────────────────────────────────
-- Mirrors auth.users; id must match the Supabase Auth user id exactly,
-- since saveUser() upserts using authUser.id as the primary key.

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "Users can read their own row" on public.users;
create policy "Users can read their own row"
  on public.users
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can insert their own row" on public.users;
create policy "Users can insert their own row"
  on public.users
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update their own row" on public.users;
create policy "Users can update their own row"
  on public.users
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── SESSIONS ───────────────────────────────────────────────────────────────

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text,
  subject text,
  difficulty text,
  tech_score numeric,
  comm_score numeric,
  completeness_score numeric,
  duration_seconds integer,
  feedback_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_created_idx
  on public.sessions(user_id, created_at desc);

alter table public.sessions enable row level security;

drop policy if exists "Users can read their sessions" on public.sessions;
create policy "Users can read their sessions"
  on public.sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their sessions" on public.sessions;
create policy "Users can create their sessions"
  on public.sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their sessions" on public.sessions;
create policy "Users can update their sessions"
  on public.sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── STREAKS ────────────────────────────────────────────────────────────────
-- One row per user — getStreak/updateStreak use maybeSingle(), so user_id
-- must be unique, not just indexed.

create table if not exists public.streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date
);

alter table public.streaks enable row level security;

drop policy if exists "Users can read their streak" on public.streaks;
create policy "Users can read their streak"
  on public.streaks
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their streak" on public.streaks;
create policy "Users can create their streak"
  on public.streaks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their streak" on public.streaks;
create policy "Users can update their streak"
  on public.streaks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── GRANTS ─────────────────────────────────────────────────────────────────

grant all on public.users to authenticated;
grant all on public.sessions to authenticated;
grant all on public.streaks to authenticated;