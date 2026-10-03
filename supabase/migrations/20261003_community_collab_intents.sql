-- Collab intent tags for Community discovery. Run in Supabase SQL if not auto-applied.

alter table public.users
  add column if not exists community_collab_intents text[] not null default '{}';
