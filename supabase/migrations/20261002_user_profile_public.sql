-- User profile fields + public profile read policy.
-- Run in Supabase SQL editor if migrations are not auto-applied.

alter table public.users
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists avatar_override boolean not null default false,
  add column if not exists bio text,
  add column if not exists profile_public boolean not null default true,
  add column if not exists hide_artists_on_profile boolean not null default false;

drop policy if exists "users read public profiles" on public.users;
create policy "users read public profiles" on public.users
  for select using (profile_public = true or id = auth.uid());
