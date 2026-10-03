-- Studio teams: shared workspace access for managers.

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
