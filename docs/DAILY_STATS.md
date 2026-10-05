# Daily stats digest (email / push)

Analytics → **Daily stats digest** reads preferences from `public.users` and preview data via the `getDailyStatsDigest` edge function. The hourly sender is `sendDailyStatsDigest` (cron).

## Database (required once)

If the app shows **`column users.daily_stats_email_enabled does not exist`**, run this in **Supabase → SQL → New query**:

```sql
-- From supabase/migrations/20261005_daily_stats_full.sql
alter table public.users
  add column if not exists timezone text,
  add column if not exists daily_stats_notify_time text not null default '08:00',
  add column if not exists daily_stats_email_enabled boolean not null default false,
  add column if not exists daily_stats_push_enabled boolean not null default false,
  add column if not exists daily_stats_last_sent_at timestamptz;
```

Migrations are **not** applied automatically by the GitHub Deploy workflow (see [GITHUB_DEPLOY.md](./GITHUB_DEPLOY.md)).

## Edge functions

Deploy `getDailyStatsDigest` and `sendDailyStatsDigest`. Optional cron: `.github/workflows/` or Supabase scheduled invoke for `sendDailyStatsDigest`.

## User timezone

`timezone` on `users` (IANA, e.g. `Europe/Stockholm`) drives “yesterday” for the digest and the local **Deliver around** time. The app syncs browser timezone when it differs.
