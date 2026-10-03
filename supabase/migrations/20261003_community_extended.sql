-- Community profile extensions + reports. Run in Supabase SQL editor if not auto-applied.

alter table public.users
  add column if not exists featured_release_id uuid,
  add column if not exists show_active_campaign_badge boolean not null default false,
  add column if not exists allow_public_contact boolean not null default false,
  add column if not exists community_verified_at timestamptz;

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
