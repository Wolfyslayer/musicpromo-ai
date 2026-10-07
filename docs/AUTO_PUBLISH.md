# Campaign auto-publish (timing & ops)

Auto-publish is **not** instant at the scheduled second. A background **`campaignWorker`** must run to create `SocialPost` rows (from scheduled `CampaignDay`s) and call each platform API.

## How it runs

| Trigger | When |
|---------|------|
| **GitHub Actions cron** | Every **5 minutes**, plus an **offset** workflow (~**2–3 min** average) — **required for posts when the app is closed** |
| **`campaignSchedule`** | Immediate kick when you queue a day (stronger kick if due within 15 minutes) |
| **App open (signed in)** | `GlobalAutoPublishKick` nudges the worker every **2 minutes** while the tab is visible |
| **Campaign plan page** | `useOverdueAutoPublish` nudges every **45s** while a day is overdue |

## One-time setup (critical)

1. In **GitHub → Settings → Secrets and variables → Actions**, set:
   - `SUPABASE_URL` — Project URL from Supabase → Settings → API
   - `SUPABASE_SERVICE_ROLE_KEY` — service role key (never expose in the frontend)

2. Confirm workflows are enabled:
   - `.github/workflows/campaign-worker-cron.yml`
   - `.github/workflows/campaign-worker-cron-offset.yml`

3. In **Supabase → Edge Functions → Secrets**, set **`SOCIAL_TOKEN_ENCRYPTION_KEY`** (without it, the worker marks days failed instead of publishing).

4. **Analytics auto-sync:** `.github/workflows/analytics-sync-cron.yml` runs **every hour** and calls `campaignWorker` with publish/video skipped so IG/TikTok/YouTube stats refresh in the Analytics tab. Requires the same secrets plus `SOCIAL_TOKEN_ENCRYPTION_KEY` on the edge function.

5. **Do not** rely on a Base44 **hourly** scheduled workflow for publish — that is too slow. Use the GitHub cron above or an external ping (e.g. [cron-job.org](https://cron-job.org)) every **1–5 minutes** to:

   `POST {SUPABASE_URL}/functions/v1/campaignWorker`  
   `Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}`  
   Body: `{"skipStats":true,"batchLimit":30}`

## Manual “publish now”

From the campaign plan, **Run worker now** (or call `kickCampaignWorker` from the client) processes due `scheduled_at` posts immediately.

## Status flow

`scheduled` → `publishing` / day `processing` → `published` / day `posted` (or `failed` with `publish_error`).

See also [SOCIAL_OAUTH_SETUP.md](./SOCIAL_OAUTH_SETUP.md) and [GITHUB_DEPLOY.md](./GITHUB_DEPLOY.md).
