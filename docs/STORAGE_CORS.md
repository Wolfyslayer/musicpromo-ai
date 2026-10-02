# Supabase Storage CORS (promo video on `musicpromoai.site`)

On-device promo MP4 encoding reads **artwork** and **audio** in the browser. Files live in the public bucket **`music-promo-assets`** at URLs like:

`https://<project-ref>.supabase.co/storage/v1/object/public/music-promo-assets/...`

From **`https://musicpromoai.site`**, the browser needs **CORS** on those responses, or a **proxy** with CORS headers. Otherwise you may see:

`VideoFrames can't be created from tainted sources`

---

## Option 1 — Edge Function proxy (recommended, works from phone)

The repo includes **`promoMediaProxy`**: same Supabase project, adds CORS for allowed public bucket URLs.

1. Merge/deploy Edge Functions (GitHub **Deploy** workflow or `supabase functions deploy promoMediaProxy`).
2. Redeploy the **frontend** (uses the proxy automatically when direct Storage fetch fails).

No dashboard CORS UI required.

---

## Option 2 — Bucket CORS (CLI, from a computer)

If your Supabase CLI supports bucket CORS (check `supabase storage --help` on your version):

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
export SUPABASE_PROJECT_REF=hmqxptxtcejhmuwbegvq

supabase storage update-bucket-cors music-promo-assets \
  --project-ref "$SUPABASE_PROJECT_REF" \
  --cors-config '{
    "allowedOrigins": ["https://musicpromoai.site", "http://localhost:5173"],
    "allowedMethods": ["GET", "HEAD", "OPTIONS"],
    "allowedHeaders": ["*"],
    "maxAgeSeconds": 3600
  }'
```

Adjust origins if you also use a `*.github.io` URL without a custom domain.

---

## Option 3 — Supabase Dashboard

Storage CORS is **not** available in all projects/regions. If you see **Storage → `music-promo-assets` → Configuration → CORS**, add:

| Field | Value |
|--------|--------|
| Allowed origins | `https://musicpromoai.site` |
| | `http://localhost:5173` (local dev) |
| Allowed methods | `GET`, `HEAD`, `OPTIONS` |
| Allowed headers | `*` or `authorization`, `apikey`, `content-type` |

Save, wait a minute, re-render the promo video.

If there is **no CORS section**, use **Option 1** (proxy).

---

## Option 4 — Same session, local files

During **Create campaign**, if you upload artwork/audio on the same device, the app uses **local `File` blobs** and does not need Storage CORS for that render.

Re-rendering **later** from URLs only needs Option 1, 2, or 3.

---

## Verify

1. Open a public artwork URL in a new tab (should load the image).
2. On Social Hub or Campaign → render promo video again.
3. You should not see the tainted `VideoFrame` error.

See also [GITHUB_DEPLOY.md](./GITHUB_DEPLOY.md) troubleshooting row for **tainted VideoFrame**.
