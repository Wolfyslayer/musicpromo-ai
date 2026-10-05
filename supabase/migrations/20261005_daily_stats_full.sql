-- Daily stats digest + timezone (run once in Supabase SQL editor if Analytics shows
-- "column users.daily_stats_email_enabled does not exist").
-- Safe to re-run: uses IF NOT EXISTS.

alter table public.users
  add column if not exists timezone text,
  add column if not exists daily_stats_notify_time text not null default '08:00',
  add column if not exists daily_stats_email_enabled boolean not null default false,
  add column if not exists daily_stats_push_enabled boolean not null default false,
  add column if not exists daily_stats_last_sent_at timestamptz;
