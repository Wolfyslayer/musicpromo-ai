# Daily stats digest (email / push)

Analytics → **Daily stats digest** reads preferences from `public.users` and preview data via the `getDailyStatsDigest` edge function. The hourly sender is `sendDailyStatsDigest` (GitHub cron).

Use this doc as an **operator checklist** to turn on daily email and/or push end-to-end.

---

## Quick architecture

| Piece | What it does |
| --- | --- |
| **Analytics → Sync now** | Calls `socialStatsSync` — pulls IG / TikTok / YouTube into `analytics_entries`. |
| **`.github/workflows/analytics-sync-cron.yml`** | Hourly `campaignWorker` with `skipPublish` / `skipVideo` — keeps stats fresh without the app open. |
| **`.github/workflows/daily-stats-digest-cron.yml`** | Hourly `sendDailyStatsDigest` — sends **once per local calendar day** after your **Deliver around** time. |
| **`getDailyStatsDigest`** | In-app preview + schema check. |
| **`sendDailyStatsDigest`** | Resend email + FCM push; auth via shared cron secret. |

Digest numbers come from **`analytics_entries`** rows whose `data.date` matches today/yesterday in your stored **timezone** (see aggregation in `statsDigestAgg.ts`).

---

## Checklist (do in order)

### 1. Database columns on `public.users` (one time)

Migrations are **not** applied by the GitHub Deploy workflow ([GITHUB_DEPLOY.md](./GITHUB_DEPLOY.md)).

If Analytics shows **`column users.daily_stats_email_enabled does not exist`**, open **Supabase → SQL → New query** and run the full file:

`supabase/migrations/20261005_daily_stats_full.sql`

Minimum (if you only need digest prefs):

```sql
alter table public.users
  add column if not exists timezone text,
  add column if not exists daily_stats_notify_time text not null default '08:00',
  add column if not exists daily_stats_email_enabled boolean not null default false,
  add column if not exists daily_stats_push_enabled boolean not null default false,
  add column if not exists daily_stats_last_sent_at timestamptz;
```

**Verify:** Table Editor → `users` → your row has `email`, optional `timezone`, toggles default `false`.

**Push only:** ensure `push_devices` exists (native migration in repo — run that SQL file in Supabase if the table is missing). See [NATIVE_APP.md](./NATIVE_APP.md).

---

### 2. Deploy edge functions

Deploy at least:

- `getDailyStatsDigest`
- `sendDailyStatsDigest`
- `socialStatsSync` (manual sync)
- `campaignWorker` (hourly analytics cron)

**Option A — merge to `main`:** push changes under `supabase/functions/**` and let **Actions → Deploy** run (or **Run workflow** manually to force backend deploy).

**Option B — CLI:**

```bash
supabase functions deploy getDailyStatsDigest sendDailyStatsDigest socialStatsSync campaignWorker --project-ref YOUR_REF
```

---

### 3. Supabase Edge Function secrets

**Project Settings → Edge Functions → Secrets** (or `supabase secrets set ... --project-ref YOUR_REF`).

| Secret | Required for | Notes |
| --- | --- | --- |
| `LAUNCH_DIGEST_CRON_SECRET` | Cron + manual curl | Long random string; must **match** GitHub secret below. |
| `RESEND_API_KEY` | Email | From [Resend](https://resend.com) → API Keys. |
| `LAUNCH_DIGEST_FROM_EMAIL` | Email | e.g. `MusicPromo AI <digest@musicpromoai.site>` — **from** address must use a **verified domain** in Resend. |
| `FCM_SERVICE_ACCOUNT_JSON` | Push send | Firebase service account JSON (single secret value). Not needed for email-only. |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | Platform sync | Required for analytics sync from social APIs ([GITHUB_DEPLOY.md](./GITHUB_DEPLOY.md)). |

Generate a cron secret (example):

```bash
openssl rand -base64 32
```

Set the **same** value in Supabase as `LAUNCH_DIGEST_CRON_SECRET` and in GitHub (step 4).

---

### 4. GitHub Actions repository secrets

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Used by |
| --- | --- |
| `SUPABASE_PROJECT_REF` | Daily stats cron (`https://REF.supabase.co`) |
| `LAUNCH_DIGEST_CRON_SECRET` | Daily stats cron (must match Supabase) |
| `SUPABASE_URL` | Analytics sync cron (`https://REF.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Analytics sync cron |

Without `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, **Analytics stats sync (hourly)** exits 0 and skips — digests may be empty until you **Sync now** in the app.

---

### 5. Resend (email deliverability)

1. Create a Resend account and add your sending domain (e.g. `musicpromoai.site`).
2. Add DNS records Resend shows (SPF/DKIM/etc.) until the domain is **Verified**.
3. Create an API key → Supabase `RESEND_API_KEY`.
4. Set `LAUNCH_DIGEST_FROM_EMAIL` to an address on that domain (not `onboarding@resend.dev` in production).

Until the domain is verified, Resend may reject or only allow test recipients.

---

### 6. Confirm GitHub workflows are on `main`

These files must exist on your default branch (they schedule automatically):

- `.github/workflows/daily-stats-digest-cron.yml` — `0 * * * *` (hourly)
- `.github/workflows/analytics-sync-cron.yml` — `0 * * * *` (hourly)

**Actions** tab → enable workflows if the repo disabled them.

---

### 7. Populate analytics data

The digest can send with **zero rows** (email explains “no stats logged”), but you usually want real numbers first:

1. Connect Instagram / TikTok / YouTube in the app.
2. **Analytics → Sync now** (or wait for hourly analytics cron).
3. In Supabase **Table Editor → `analytics_entries`**, confirm rows for your `user_id` with `data.date` as `YYYY-MM-DD`.

Platform sync issues are separate — fix OAuth and redeploy `socialStatsSync` / `campaignWorker` if only one platform appears.

---

### 8. Turn on notifications in the app

**Analytics** or **Settings → Appearance & notifications** → **Daily stats digest**:

1. Set **Deliver around** (local time). Uses browser timezone; stored on `users.timezone`.
2. Turn **Email** on (`daily_stats_email_enabled`).
3. For **Push**: install the **native app**, allow notifications, then turn push on — registers `push_devices` and sets `daily_stats_push_enabled`.

The in-app panel loads a **preview** via `getDailyStatsDigest`. If it shows a migration hint, complete step 1.

---

### 9. Test without waiting for 8:00 AM

**A. Dry-run the sender (respects time window)**

The sender only delivers when **local time ≥ Deliver around** and **not already sent today** (in your timezone).

For a same-day test:

1. Set **Deliver around** to a few minutes **before** your current local time.
2. In Supabase SQL, clear last send for your user:

```sql
update public.users
set daily_stats_last_sent_at = null
where id = 'YOUR_USER_UUID';
```

3. **Actions → Daily stats digest (hourly) → Run workflow**.

**B. Call the function directly**

```bash
curl -sS -X POST \
  -H "x-daily-stats-secret: YOUR_LAUNCH_DIGEST_CRON_SECRET" \
  "https://YOUR_REF.supabase.co/functions/v1/sendDailyStatsDigest"
```

Expect JSON like: `{ "ok": true, "emailed": 1, "pushMessages": 0, "resendConfigured": true, "errors": [] }`.

**C. Force immediate send (bypass time window)** — only for debugging:

Temporarily set `daily_stats_notify_time` to `00:00`, clear `daily_stats_last_sent_at`, run cron, then set your preferred time back.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `401 Unauthorized` from cron | Secret mismatch | Same `LAUNCH_DIGEST_CRON_SECRET` in GitHub + Supabase; header `x-daily-stats-secret`. |
| Cron log: “Skipping — set secrets” | Missing GitHub secrets | Add `SUPABASE_PROJECT_REF` + `LAUNCH_DIGEST_CRON_SECRET`. |
| `emailed: 0`, `resendConfigured: false` | No Resend key | Set `RESEND_API_KEY` in Supabase; redeploy not required for secrets-only changes. |
| `errors: ["you@…: 403"]` or Resend domain error | Unverified from domain | Verify domain; fix `LAUNCH_DIGEST_FROM_EMAIL`. |
| Email on but no mail; `no_email` in errors | Empty `users.email` | Ensure auth user has email on `public.users`. |
| Empty stats in email | No `analytics_entries` for digest date | Sync platforms; check row `data.date` vs your timezone. |
| Push on, `pushMessages: 0` | No FCM secret or no tokens | `FCM_SERVICE_ACCOUNT_JSON`; rows in `push_devices`; native app registration. |
| Preview error about `daily_stats_*` | Migration not run | Step 1 SQL. |
| Never sends at chosen time | Cron not running | Workflow on `main`; secrets set; local time past **Deliver around**. |

---

## User-facing behavior (reference)

- **Timezone:** IANA string on `users.timezone` (e.g. `America/New_York`). App syncs from browser when different.
- **Deliver around:** `daily_stats_notify_time` as `HH:mm` (24h). Hourly cron picks users whose local time is **at or after** that time and who have not received a digest **this local calendar day** (`daily_stats_last_sent_at`).
- **Email content:** Subject/body from `statsDigestAgg.ts`; links to Analytics.
- **Disable:** Turn off email/push toggles in the app anytime.

---

## Related docs

- [GITHUB_DEPLOY.md](./GITHUB_DEPLOY.md) — deploy workflow, social secrets, cron overview  
- [NATIVE_APP.md](./NATIVE_APP.md) — Firebase, `push_devices`, FCM service account  
- [AUTO_PUBLISH.md](./AUTO_PUBLISH.md) — campaign worker crons (separate from daily stats)
