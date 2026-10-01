-- Run this if schema.sql was applied before social posts and OAuth state were added.
alter table public.campaign_days drop constraint if exists campaign_days_kind_check;
alter table public.campaign_days
  add constraint campaign_days_kind_check
  check (kind in ('campaign', 'day', 'content', 'post', 'oauth_state', 'checkpoint'));

alter table public.prepared_media drop constraint if exists prepared_media_kind_check;
alter table public.prepared_media
  add constraint prepared_media_kind_check
  check (kind in ('artist', 'song', 'release', 'video', 'asset'));
