-- Helpers to find music-promo-assets paths referenced in app data (run in SQL editor).
-- Actual deletion uses the purgeCampaignStorage Edge Function (service role + Storage API).
-- Manual delete example at the bottom — run as postgres / service role only.

create or replace function public.extract_promo_asset_paths(blob text)
returns setof text
language sql
immutable
as $$
  select distinct (regexp_matches(coalesce(blob, ''), 'music-promo-assets/([^?"''#\s]+)', 'gi'))[1];
$$;

comment on function public.extract_promo_asset_paths(text) is
  'Pulls object paths (user_id/folder/file) from URLs embedded in JSON/text.';

-- All referenced paths for one user (campaign_days + prepared_media + profile avatar).
create or replace function public.list_referenced_promo_paths(p_user_id uuid)
returns table (path text)
language sql
stable
security definer
set search_path = public
as $$
  with blobs as (
    select coalesce(data::text, '') as b
    from public.campaign_days
    where user_id = p_user_id
    union all
    select coalesce(data::text, '') || ' ' || coalesce(public_url, '') || ' ' || coalesce(storage_path, '')
    from public.prepared_media
    where user_id = p_user_id
    union all
    select coalesce(avatar_url, '')
    from public.users
    where id = p_user_id
  )
  select distinct e.path
  from blobs
  cross join lateral public.extract_promo_asset_paths(blobs.b) as e(path)
  where e.path is not null and e.path <> '';
$$;

-- Orphan objects: in bucket under this user folder but not referenced anywhere in DB.
create or replace function public.list_orphan_promo_storage(p_user_id uuid)
returns table (object_name text, bucket_id text)
language sql
stable
security definer
set search_path = public, storage
as $$
  select o.name as object_name, o.bucket_id
  from storage.objects o
  where o.bucket_id = 'music-promo-assets'
    and o.name like p_user_id::text || '/%'
    and not exists (
      select 1
      from public.list_referenced_promo_paths(p_user_id) r
      where r.path = o.name
    );
$$;

comment on function public.list_orphan_promo_storage(uuid) is
  'Inspect orphan files before delete. Use Edge Function purgeCampaignStorage for safe removal.';

grant execute on function public.extract_promo_asset_paths(text) to authenticated, service_role;
grant execute on function public.list_referenced_promo_paths(uuid) to authenticated, service_role;
grant execute on function public.list_orphan_promo_storage(uuid) to authenticated, service_role;

-- Example (replace YOUR_USER_UUID, run once, review rows first):
-- select * from public.list_orphan_promo_storage('YOUR_USER_UUID'::uuid);
--
-- delete from storage.objects o
-- using public.list_orphan_promo_storage('YOUR_USER_UUID'::uuid) x
-- where o.bucket_id = 'music-promo-assets' and o.name = x.object_name;
