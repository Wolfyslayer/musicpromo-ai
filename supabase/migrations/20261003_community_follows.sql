-- Community follows + spotlight fields. Run in Supabase SQL editor if migrations are not auto-applied.

alter table public.users
  add column if not exists community_featured boolean not null default false,
  add column if not exists last_active_at timestamptz;

create table if not exists public.community_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users (id) on delete cascade,
  followed_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint community_follows_no_self check (follower_id <> followed_user_id),
  unique (follower_id, followed_user_id)
);

create index if not exists community_follows_follower_idx
  on public.community_follows (follower_id);

create index if not exists community_follows_followed_idx
  on public.community_follows (followed_user_id);

alter table public.community_follows enable row level security;

create policy "follows read own" on public.community_follows
  for select using (follower_id = auth.uid());

create policy "follows insert own" on public.community_follows
  for insert with check (follower_id = auth.uid());

create policy "follows delete own" on public.community_follows
  for delete using (follower_id = auth.uid());

-- Hand-pick spotlight artists, e.g.:
-- update public.users set community_featured = true where lower(handle) = 'yourhandle';
