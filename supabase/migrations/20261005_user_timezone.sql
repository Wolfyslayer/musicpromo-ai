-- User timezone for accurate schedules and daily stats digests.
alter table public.users
  add column if not exists timezone text,
  add column if not exists daily_stats_notify_time text not null default '08:00';
