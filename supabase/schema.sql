-- MusicPromo AI tables for Supabase.
-- Run this in the Supabase SQL editor, then create the public bucket below.

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  display_name text,
  avatar_url text,
  avatar_override boolean not null default false,
  bio text,
  profile_public boolean not null default true,
  hide_artists_on_profile boolean not null default false,
  handle text,
  role text default 'artist',
  community_featured boolean not null default false,
  featured_release_id uuid,
  show_active_campaign_badge boolean not null default false,
  allow_public_contact boolean not null default false,
  community_verified_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists community_reports_reported_idx
  on public.community_reports (reported_user_id);

alter table public.community_reports enable row level security;

create policy "reports insert own" on public.community_reports
  for insert with check (reporter_id = auth.uid());

create policy "reports read own" on public.community_reports
  for select using (reporter_id = auth.uid());

create table if not exists public.community_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users (id) on delete cascade,
  followed_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint community_follows_no_self check (follower_id <> followed_user_id),
  unique (follower_id, followed_user_id)
);

create table if not exists public.campaign_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid,
  kind text not null check (kind in ('campaign', 'day', 'content', 'post', 'oauth_state', 'checkpoint')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.prepared_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid,
  kind text not null check (kind in ('artist', 'song', 'release', 'video', 'asset')),
  public_url text,
  storage_path text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.analytics_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.users enable row level security;
alter table public.campaign_days enable row level security;
alter table public.prepared_media enable row level security;
alter table public.social_accounts enable row level security;
alter table public.analytics_entries enable row level security;
alter table public.community_follows enable row level security;

create policy "users read own profile" on public.users for select using (id = auth.uid());
create policy "users read public profiles" on public.users for select using (profile_public = true or id = auth.uid());
create policy "users insert own profile" on public.users for insert with check (id = auth.uid());
create policy "users update own profile" on public.users for update using (id = auth.uid());

create policy "follows read own" on public.community_follows
  for select using (follower_id = auth.uid());
create policy "follows insert own" on public.community_follows
  for insert with check (follower_id = auth.uid());
create policy "follows delete own" on public.community_follows
  for delete using (follower_id = auth.uid());

create policy "own campaign days" on public.campaign_days
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own prepared media" on public.prepared_media
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own social accounts" on public.social_accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own analytics" on public.analytics_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('music-promo-assets', 'music-promo-assets', true)
on conflict (id) do update set public = true;

create policy "public read promo assets" on storage.objects
  for select using (bucket_id = 'music-promo-assets');

create policy "artists upload promo assets" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'music-promo-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
