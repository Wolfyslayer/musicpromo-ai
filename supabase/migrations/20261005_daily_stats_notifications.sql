-- Daily stats digest (email / push) preferences on public.users
alter table public.users
  add column if not exists daily_stats_email_enabled boolean not null default false,
  add column if not exists daily_stats_push_enabled boolean not null default false,
  add column if not exists daily_stats_last_sent_at timestamptz;
