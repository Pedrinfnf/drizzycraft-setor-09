-- Strict Row-Level Security (RLS) schema for DrizzyCraft: Setor 09 Cloud Save (Supabase Free Tier)
create table if not exists public.user_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save_data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_saves enable row level security;

create policy "Users can read own save"
  on public.user_saves for select
  using (auth.uid() = user_id);

create policy "Users can insert own save"
  on public.user_saves for insert
  with check (auth.uid() = user_id);

create policy "Users can update own save"
  on public.user_saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
