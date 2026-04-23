create extension if not exists pgcrypto;

create table if not exists public.question_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.question_bank_items (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.question_sets(id) on delete cascade,
  question_text text not null,
  sort_order integer not null default 0
);

create index if not exists question_sets_user_created_idx
  on public.question_sets(user_id, created_at desc);

create index if not exists question_bank_items_set_order_idx
  on public.question_bank_items(set_id, sort_order);

alter table public.question_sets enable row level security;
alter table public.question_bank_items enable row level security;

drop policy if exists "Users can read their question sets" on public.question_sets;
create policy "Users can read their question sets"
  on public.question_sets
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their question sets" on public.question_sets;
create policy "Users can create their question sets"
  on public.question_sets
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their question sets" on public.question_sets;
create policy "Users can update their question sets"
  on public.question_sets
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their question sets" on public.question_sets;
create policy "Users can delete their question sets"
  on public.question_sets
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read their question bank items" on public.question_bank_items;
create policy "Users can read their question bank items"
  on public.question_bank_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.question_sets
      where question_sets.id = question_bank_items.set_id
        and question_sets.user_id = auth.uid()
    )
  );

drop policy if exists "Users can create their question bank items" on public.question_bank_items;
create policy "Users can create their question bank items"
  on public.question_bank_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.question_sets
      where question_sets.id = question_bank_items.set_id
        and question_sets.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their question bank items" on public.question_bank_items;
create policy "Users can update their question bank items"
  on public.question_bank_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.question_sets
      where question_sets.id = question_bank_items.set_id
        and question_sets.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.question_sets
      where question_sets.id = question_bank_items.set_id
        and question_sets.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their question bank items" on public.question_bank_items;
create policy "Users can delete their question bank items"
  on public.question_bank_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.question_sets
      where question_sets.id = question_bank_items.set_id
        and question_sets.user_id = auth.uid()
    )
  );

grant all on public.question_sets to authenticated;
grant all on public.question_bank_items to authenticated;
