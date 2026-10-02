# GitHub Actions deploy (Supabase + frontend)

Pushes to **`main`** run [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):

1. **Backend** — deploy Edge Functions **only if** `supabase/functions/**` or `supabase/config.toml` changed on that push.
2. **Frontend** — build and publish **only if** app source or frontend deps changed (`src/`, `public/`, `package.json`, etc.).

**Manual run:** **Actions → Deploy → Run workflow** deploys **both** jobs (even when nothing changed in those paths).

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

**Settings → Secrets and variables → Actions → New repository secret**

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

### 3. Supabase Edge Function secrets (not in GitHub)

AI and OAuth handlers read secrets from **Supabase**, not from the frontend bundle. Set these once in the dashboard (**Project Settings → Edge Functions → Secrets**) or via CLI:

```bash
supabase secrets set OPENAI_API_KEY=sk-... --project-ref YOUR_REF
# Free-tier alternative (Groq): see docs/FREE_AI.md — set OPENAI_BASE_URL and OPENAI_MODEL too.

# Social connect (required for Instagram / TikTok / YouTube — not stored in GitHub)
supabase secrets set PUBLIC_APP_URL=https://musicpromoai.site --project-ref YOUR_REF
supabase secrets set SOCIAL_TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)" --project-ref YOUR_REF
# Platform OAuth (same values you used on Base44, if migrating):
# META_CLIENT_ID, META_CLIENT_SECRET, TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET,
# GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (YouTube channel client), GOOGLE_LOGIN_CLIENT_SECRET (login)
```

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
| App loads but auth/API fails | `VITE_*` secrets wrong or from a different project than deployed functions |
| Routes 404 on refresh (GitHub Pages) | Workflow copies `index.html` → `404.html`; ensure Pages source is **GitHub Actions** |
| Blank page, gray/white screen | **Wrong `VITE_BASE_PATH`.** For `musicpromoai.site` use **`/`** only — never the domain (`/MusicPromoAi.site/`). Delete the bad variable or set `VITE_BASE_PATH` = `/`, then re-run **Deploy**. View page source: script `src` should be `/assets/...`, not `/yourdomain/...`. |
| “Connection is not secure” | Site opened over **http://** or HTTPS not ready. In **Pages**, wait for DNS check → enable **Enforce HTTPS** → use **https://** |
| Video render: **tainted VideoFrame** / CORS | Deploy **`promoMediaProxy`** + frontend, or configure Storage CORS — see **[docs/STORAGE_CORS.md](./STORAGE_CORS.md)**. Local upload files during create also avoid CORS for that session. |

## Other frontend hosts

The build step only needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optional `VITE_BASE_PATH`. You can reuse the same env vars on Vercel, Netlify, or Cloudflare Pages and keep this workflow’s **deploy-supabase** job only (split workflows if you prefer).
