-- Native app push notification device registry (idempotent).

alter table public.users add column if not exists push_digest_enabled boolean not null default true;

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now(),
  unique (token)
);

create index if not exists push_devices_user_idx on public.push_devices (user_id);

alter table public.push_devices enable row level security;

drop policy if exists "push devices read own" on public.push_devices;
create policy "push devices read own" on public.push_devices
  for select using (user_id = auth.uid());

-- Inserts/updates/deletes via Edge Functions (service role) only.
