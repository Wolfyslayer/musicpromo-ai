# Native iOS / Android (Capacitor)

The web app ships inside **Capacitor** for App Store / Play Store builds. **One codebase** — the same Vite `dist/` that GitHub Actions publishes to **musicpromoai.site** is copied into native projects.

## How this fits GitHub Actions (recommended)

You already use **[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)** on every push to `main`. Treat native as a **second deliverable** from the same build, not a separate backend.

| What | Handled by | When |
|------|------------|------|
| **Web** (musicpromoai.site) | Deploy → **Frontend (GitHub Pages)** | Push to `main` when `src/`, `package.json`, `capacitor.config.ts`, etc. change |
| **Edge Functions** (incl. `registerPushToken`) | Deploy → **Supabase** | Push when `supabase/functions/**` changes |
| **Postgres schema** (`push_devices`, …) | **You** (Supabase SQL editor) | Once per migration file — Actions does **not** auto-run SQL yet |
| **Supabase secrets** (FCM, Resend, OpenAI) | **Supabase dashboard** | Not GitHub — see [GITHUB_DEPLOY.md](./GITHUB_DEPLOY.md) |
| **Store `.ipa` / `.aab`** | **You** (Mac + Xcode / Android Studio) or future signing workflow | After web + functions are live |

### Release rhythm that keeps web and native aligned

1. **Merge to `main`** → wait for **Deploy** to finish (green).  
   - Site and Edge Functions match the commit you will ship in the store.
2. **Apply SQL** if the merge added `supabase/migrations/*.sql` (e.g. `20261004_native_push.sql`).  
   - Dashboard → SQL → paste migration → Run.
3. **Prepare the native bundle** (pick one):
   - **Local:** `git pull && npm ci && npm run build && npm run cap:sync`
   - **CI artifact:** Actions → **Prepare native bundle** → download `capacitor-web-dist` → unzip into `dist/` → `npm run cap:sync` on your Mac
4. **Archive** in Xcode / Android Studio → TestFlight / Play internal testing.

The native shell loads **bundled `dist/`** (default in `capacitor.config.ts`). It talks to the **same** Supabase project as the website (`VITE_SUPABASE_*` in the GitHub build). You do **not** need a separate Supabase project for the app.

### What runs automatically when you merge native code

- **Capacitor npm packages** → frontend job rebuilds (via `package-lock.json`).
- **`registerPushToken` / `unregisterPushToken`** → Supabase deploy when under `supabase/functions/`.
- **Web users** → unchanged; push UI only appears when `Capacitor.isNativePlatform()` is true.

### What Actions does *not* do (by design)

- **No App Store upload** — needs Apple certificates on `macos-latest` (add later if you want).
- **No Firebase plist/json in repo** — add locally or via encrypted secrets in a future native-signing workflow.
- **No automatic SQL** — run migrations manually or add `supabase db push` later.

---

## First-time setup (local)

1. Install deps: `npm install`
2. Match production env (same as GitHub secrets):
   ```bash
   export VITE_SUPABASE_URL=https://YOUR_REF.supabase.co
   export VITE_SUPABASE_ANON_KEY=your-anon-key
   npm run build
   ```
3. Add platforms (once per clone):
   ```bash
   npx cap add ios
   npx cap add android
   ```
4. After each release build:
   ```bash
   npm run cap:sync
   npm run cap:ios    # or cap:android
   ```

`ios/` and `android/` are **gitignored** by default. Generate them on your machine; optional **Prepare native bundle** workflow only ships `dist/`.

---

## Supabase (push + auth)

Run in SQL editor (once):

- **`supabase/migrations/20261004_native_push.sql`**

Functions deploy via **Deploy** on `main`, or manually:

```bash
supabase functions deploy registerPushToken unregisterPushToken --project-ref YOUR_REF
```

---

## Firebase Cloud Messaging (push)

1. Create a [Firebase](https://console.firebase.google.com) project linked to your iOS/Android apps.
2. **iOS:** upload **APNs key** in Firebase → Cloud Messaging.
3. **Android:** place `google-services.json` in `android/app/` (never commit — see `.gitignore`).
4. **iOS:** add `GoogleService-Info.plist` in Xcode.
5. **Sending** weekly pushes (phase 3): store service account JSON in Supabase as `FCM_SERVICE_ACCOUNT_JSON`; extend `sendLaunchDigest` / cron.

Registration works without FCM server secrets; **sending** does not.

---

## OAuth / deep links

Register Universal Links / App Links for:

- `https://musicpromoai.site/auth/google/callback`
- Social OAuth callback paths

Use **`@capacitor/browser`** for provider login when native flows need the system browser (future hardening).

---

## Dev against production URL (internal testing only)

```bash
CAP_SERVER_URL=https://musicpromoai.site npm run cap:sync
```

Uses live site inside the WebView — good for quick QA; **store builds should use bundled `dist/`** from the same commit you tested on the web.

---

## Roadmap

- [ ] FCM in **`sendLaunchDigest`** when `push_digest_enabled` is true  
- [ ] Optional **`native-release.yml`** on tag `v*` with Fastlane + signing secrets  
- [ ] Optional **`supabase db push`** job when `supabase/migrations/**` changes  
