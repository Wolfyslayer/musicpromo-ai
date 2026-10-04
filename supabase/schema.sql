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
  community_collab_intents text[] not null default '{}',
  launch_digest_enabled boolean not null default true,
  launch_digest_last_sent_at timestamptz,
  push_digest_enabled boolean not null default true,
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

create table if not exists public.community_promo_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  message text not null,
  campaign_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint community_promo_no_self check (requester_id <> target_user_id)
);

create table if not exists public.community_circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  invite_code text not null unique,
  max_members int not null default 20,
  created_at timestamptz not null default now()
);

create table if not exists public.community_circle_members (
  circle_id uuid not null references public.community_circles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

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

create table if not exists public.workspace_studios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_studio_members (
  studio_id uuid not null references public.workspace_studios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'manager')),
  created_at timestamptz not null default now(),
  primary key (studio_id, user_id)
);

create index if not exists workspace_studio_members_user_idx
  on public.workspace_studio_members (user_id);

alter table public.workspace_studios enable row level security;
alter table public.workspace_studio_members enable row level security;

create policy "studio members read studio" on public.workspace_studios
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.workspace_studio_members m
      where m.studio_id = id and m.user_id = auth.uid()
    )
  );

create policy "studio members read roster" on public.workspace_studio_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspace_studios s
      where s.id = studio_id and s.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.workspace_studio_members m2
      where m2.studio_id = studio_id and m2.user_id = auth.uid()
    )
  );

create or replace function public.studio_can_access_owner(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select owner = auth.uid()
  or exists (
    select 1
    from public.workspace_studios s
    join public.workspace_studio_members m on m.studio_id = s.id
    where s.owner_id = owner
      and m.user_id = auth.uid()
      and m.role in ('owner', 'manager')
  );
$$;

create policy "studio manager campaign days" on public.campaign_days
  for all using (public.studio_can_access_owner(user_id))
  with check (public.studio_can_access_owner(user_id));

create policy "studio manager prepared media" on public.prepared_media
  for all using (public.studio_can_access_owner(user_id))
  with check (public.studio_can_access_owner(user_id));

create policy "studio manager social accounts" on public.social_accounts
  for all using (public.studio_can_access_owner(user_id))
  with check (public.studio_can_access_owner(user_id));

create policy "studio manager analytics" on public.analytics_entries
  for all using (public.studio_can_access_owner(user_id))
  with check (public.studio_can_access_owner(user_id));

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  subject text not null,
  message text not null,
  transcript jsonb not null default '[]'::jsonb,
  page_path text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx on public.support_tickets (user_id, created_at desc);

create table if not exists public.support_chat_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_start timestamptz not null default now(),
  message_count int not null default 0
);

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now(),
  unique (token)
);

create index if not exists push_devices_user_idx on public.push_devices (user_id);

alter table public.support_tickets enable row level security;
alter table public.push_devices enable row level security;

create policy "push devices read own" on public.push_devices
  for select using (user_id = auth.uid());

create policy "support tickets read own" on public.support_tickets
  for select using (user_id is not null and user_id = auth.uid());

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
