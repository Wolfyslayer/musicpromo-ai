# GitHub Actions deploy (Supabase + frontend)

Pushes to **`main`** run [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):

1. **Backend** — deploy Edge Functions **only if** `supabase/functions/**` or `supabase/config.toml` changed on that push.
2. **Frontend** — build and publish **only if** app source or frontend deps changed (`src/`, `public/`, `package.json`, `capacitor.config.ts`, etc.).

**Native (Capacitor) apps** use the **same** frontend build and Supabase project as the website. They are **not** uploaded by this workflow. See **[docs/NATIVE_APP.md](./NATIVE_APP.md)** for the release flow and **[Prepare native bundle](../.github/workflows/native-prepare.yml)** (`workflow_dispatch`) to download a CI-built `dist/` before `cap sync` on your Mac.

**Manual run:** **Actions → Deploy → Run workflow** deploys **both** jobs (even when nothing changed in those paths).

If **Auto-publish** / `campaignSchedule` fails with “Could not reach Edge Function”, run **Deploy** manually once so `campaignSchedule` and `campaignWorker` are deployed to your Supabase project.

**Pages still old after a merge?** Open the latest **Deploy** run. If **Frontend (GitHub Pages)** is *Skipped*, the push did not touch frontend paths — run the workflow manually. Changes to `.github/workflows/deploy.yml` now count as frontend changes and trigger a rebuild.

To change which paths trigger a job, edit the `filters` block in the workflow’s **Detect changes** job.

## One-time GitHub setup

### 1. Repository secrets

| Secret | Used for |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI deploy ([create token](https://supabase.com/dashboard/account/tokens), scope **Edge Functions → Read-write** for your project) |
| `SUPABASE_PROJECT_REF` | Project ref from the dashboard URL (`https://supabase.com/dashboard/project/<ref>`) |
| `VITE_SUPABASE_URL` | Same as local: `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Project **anon/public** API key (Settings → API) |
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` — used by **Campaign worker cron** (optional) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project **service_role** key (Settings → API) — cron only; never expose in the frontend |
| `GOOGLE_SERVICES_JSON` | Firebase **Android** file pasted whole (easiest on phone) — [Build Android debug APK](../.github/workflows/native-android-apk.yml) |
| `GOOGLE_SERVICES_JSON_BASE64` | *Optional* single-line base64 instead of raw JSON |
| `ANDROID_KEYSTORE_PASSWORD` | Password you choose — used by [Generate Android upload keystore](../.github/workflows/native-android-keystore.yml) |
| `ANDROID_KEY_ALIAS` | Key alias (e.g. `upload`) |
| `ANDROID_KEY_PASSWORD` | Key password you choose |
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | Copy from **android-upload-keystore-base64** artifact after keystore workflow |

**Settings → Secrets and variables → Actions → New repository secret**

Phone-first Android flow (no PC): **[docs/NATIVE_APP.md § Android from your phone only](./NATIVE_APP.md#android-from-your-phone-only-no-pc)**.

Optional: [`.github/workflows/campaign-worker-cron.yml`](../.github/workflows/campaign-worker-cron.yml) invokes `campaignWorker` every **5 minutes** so scheduled auto-posts publish on time. If the service-role secrets are missing, the workflow skips safely.

### 2. GitHub Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions**

After the first successful run, the site URL appears on the **Deployments** / **Environments → github-pages** page.

Default asset base path is `https://<user>.github.io/<repo>/`. The workflow sets `VITE_BASE_PATH=/<repo>/` automatically.

For a **custom domain at the site root**, add a repository **variable** (not secret):

| Variable | Value |
| --- | --- |
| `VITE_BASE_PATH` | `/` |

Then add your domain under **Pages → Custom domain** and configure DNS.

### 3. Database migrations (not auto-applied by Deploy)

SQL under `supabase/migrations/` (e.g. native **`push_devices`**, billing **`user_billing`**, **`user_role_guard`**) is **not** run by GitHub Actions. After merging a migration, open **Supabase → SQL editor**, paste the file, and run it once. See [BILLING.md](./BILLING.md) for Stripe + credits setup.

Optional: add a dedicated workflow with `supabase db push` and a database password secret later.

**Daily stats on Analytics** needs columns on `public.users` — run [migrations/20261005_daily_stats_full.sql](../supabase/migrations/20261005_daily_stats_full.sql) once if you see `daily_stats_email_enabled does not exist` ([DAILY_STATS.md](./DAILY_STATS.md)).

### 4. Supabase Edge Function secrets (not in GitHub)

AI and OAuth handlers read secrets from **Supabase**, not from the frontend bundle. Set these once in the dashboard (**Project Settings → Edge Functions → Secrets**) or via CLI:

```bash
supabase secrets set GEMINI_API_KEY=AIza... --project-ref YOUR_REF
# See docs/FREE_AI.md — Groq/OpenAI overrides via AI_PROVIDER and OPENAI_* secrets.

# Stripe embedded checkout (publishable key is safe to expose; secret key stays in Supabase only)
supabase secrets set STRIPE_PUBLISHABLE_KEY=pk_live_... --project-ref YOUR_REF

# Social connect (required for Instagram / TikTok / YouTube — not stored in GitHub)
supabase secrets set PUBLIC_APP_URL=https://musicpromoai.site --project-ref YOUR_REF
supabase secrets set SOCIAL_TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)" --project-ref YOUR_REF
# Platform OAuth — set every secret you use (Supabase does not inherit Base44 secrets):
supabase secrets set META_CLIENT_ID=... --project-ref YOUR_REF          # Instagram Login app
supabase secrets set META_CLIENT_SECRET=... --project-ref YOUR_REF
supabase secrets set FACEBOOK_CLIENT_ID=... --project-ref YOUR_REF      # Separate Meta app for Facebook Pages
supabase secrets set FACEBOOK_CLIENT_SECRET=... --project-ref YOUR_REF
supabase secrets set TIKTOK_CLIENT_KEY=... --project-ref YOUR_REF
supabase secrets set TIKTOK_CLIENT_SECRET=... --project-ref YOUR_REF
supabase secrets set X_CLIENT_ID=... --project-ref YOUR_REF             # X developer portal (OAuth 2.0)
supabase secrets set X_CLIENT_SECRET=... --project-ref YOUR_REF
# YouTube + Google login (often same Web client):
# GOOGLE_CLIENT_ID via VITE_GOOGLE_CLIENT_ID in GitHub Actions; GOOGLE_LOGIN_CLIENT_SECRET in Supabase
```

Register OAuth redirect `https://YOUR_REF.supabase.co/functions/v1/meta-oauth-callback` in Meta (Instagram + Facebook apps), TikTok, Google (YouTube), and X.

After adding secrets, redeploy Edge Functions (`connectSocialProvider`, `socialConnectionStatus`, `meta-oauth-callback`) via the GitHub deploy workflow or `supabase functions deploy`.

Values from **Base44 secrets do not copy automatically** to Supabase. After setting secrets, redeploy is optional (secrets apply to already-deployed functions).

Redeploying functions from GitHub does **not** remove these; they stay on the project.

## Local parity

```bash
export VITE_SUPABASE_URL=https://YOUR_REF.supabase.co
export VITE_SUPABASE_ANON_KEY=your-anon-key
npm run dev
```

Deploy functions locally (optional):

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
supabase functions deploy --project-ref YOUR_REF
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Deploy job fails immediately on Supabase step | `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF` missing or token lacks Edge Functions deploy scope |
| Deploy fails mid-run with **FGA Authentication Error** / 500 on one function | Transient Supabase API issue. **Actions → Deploy → Run workflow** again (the workflow retries up to 4 times). If it persists, regenerate the [access token](https://supabase.com/dashboard/account/tokens) with Edge Functions deploy scope. Frontend may still deploy; edge code can be ahead/behind until a full deploy succeeds. |
| App loads but auth/API fails | `VITE_*` secrets wrong or from a different project than deployed functions |
| Routes 404 on refresh (GitHub Pages) | Workflow copies `index.html` → `404.html`; ensure Pages source is **GitHub Actions** |
| Blank page, gray/white screen | **Wrong `VITE_BASE_PATH`.** For `musicpromoai.site` use **`/`** only — never the domain (`/MusicPromoAi.site/`). Delete the bad variable or set `VITE_BASE_PATH` = `/`, then re-run **Deploy**. View page source: script `src` should be `/assets/...`, not `/yourdomain/...`. |
| “Connection is not secure” | Site opened over **http://** or HTTPS not ready. In **Pages**, wait for DNS check → enable **Enforce HTTPS** → use **https://** |
| Video render: **tainted VideoFrame** / CORS | Deploy **`promoMediaProxy`** + frontend, or configure Storage CORS — see **[docs/STORAGE_CORS.md](./STORAGE_CORS.md)**. Local upload files during create also avoid CORS for that session. |

## Other frontend hosts

The build step only needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optional `VITE_BASE_PATH`. You can reuse the same env vars on Vercel, Netlify, or Cloudflare Pages and keep this workflow’s **deploy-supabase** job only (split workflows if you prefer).
