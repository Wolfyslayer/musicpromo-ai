-- Community v3: promo swap requests, circles, launch digest prefs.

alter table public.users
  add column if not exists launch_digest_enabled boolean not null default true,
  add column if not exists launch_digest_last_sent_at timestamptz;

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

create index if not exists community_promo_target_status_idx
  on public.community_promo_requests (target_user_id, status);

create index if not exists community_promo_requester_idx
  on public.community_promo_requests (requester_id, created_at desc);

create table if not exists public.community_circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  invite_code text not null unique,
  max_members int not null default 20 check (max_members > 0 and max_members <= 50),
  created_at timestamptz not null default now()
);

create table if not exists public.community_circle_members (
  circle_id uuid not null references public.community_circles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create index if not exists community_circle_members_user_idx
  on public.community_circle_members (user_id);

alter table public.community_promo_requests enable row level security;
alter table public.community_circles enable row level security;
alter table public.community_circle_members enable row level security;

create policy "promo read involved" on public.community_promo_requests
  for select using (requester_id = auth.uid() or target_user_id = auth.uid());

create policy "promo insert own" on public.community_promo_requests
  for insert with check (requester_id = auth.uid());

create policy "circles read member" on public.community_circles
  for select using (
    exists (
      select 1 from public.community_circle_members m
      where m.circle_id = id and m.user_id = auth.uid()
    )
  );

create policy "circle members read own circles" on public.community_circle_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.community_circle_members m
      where m.circle_id = circle_id and m.user_id = auth.uid()
    )
  );
