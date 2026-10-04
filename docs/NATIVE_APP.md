# Native iOS / Android (Capacitor)

The web app ships inside **Capacitor** for App Store / Play Store builds. **One codebase** — the same Vite `dist/` that GitHub Actions publishes to **musicpromoai.site** is copied into native projects.

## Complete setup checklist (zero → TestFlight / internal Play)

Use this once to wire **GitHub**, **Supabase**, **Firebase**, and **local native projects**. Order matters.

### Phase 0 — Code on `main`

1. Merge the native PR (Capacitor packages, `NativeAppBootstrap`, push Edge Functions, migration file).
2. **Actions → Deploy → Run workflow** (or push a trivial change) and wait until **Frontend** and **Supabase** jobs succeed.
3. Confirm **musicpromoai.site** loads and login works (same Supabase as the app will use).

### Phase 1 — GitHub (CI builds)

Repository **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon key (Settings → API) |
| `SUPABASE_ACCESS_TOKEN` | [Account token](https://supabase.com/dashboard/account/tokens) with Edge Functions deploy |
| `SUPABASE_PROJECT_REF` | Ref from dashboard URL |

Optional **variable** for custom domain at site root: `VITE_BASE_PATH` = `/` (see [GITHUB_DEPLOY.md](./GITHUB_DEPLOY.md)).

Optional **variables** (same as web): `VITE_GOOGLE_CLIENT_ID`, `VITE_SUPPORT_AI`, etc.

**Pages:** Settings → Pages → **Source: GitHub Actions**.

### Phase 2 — Supabase (database + functions + secrets)

1. **SQL editor** — paste and run once:
   - `supabase/migrations/20261004_native_push.sql`  
   Creates `push_devices` and `users.push_digest_enabled`.

2. **Edge Functions** — should deploy from GitHub on `main`. Verify in dashboard or:
   ```bash
   supabase functions deploy registerPushToken unregisterPushToken --project-ref YOUR_REF
   ```

3. **Edge Function secrets** (dashboard → Edge Functions → Secrets) — same as web app:
   - Auth/social: `PUBLIC_APP_URL`, platform OAuth secrets (see [GITHUB_DEPLOY.md](./GITHUB_DEPLOY.md)).
   - Support email: `RESEND_API_KEY`, `SUPPORT_FROM_EMAIL` if you use support tickets.
   - **Push sending (later):** `FCM_SERVICE_ACCOUNT_JSON` when `sendLaunchDigest` sends FCM — not required for **token registration** today.

4. **Auth** — ensure Site URL / redirect URLs include your production domain (`https://musicpromoai.site` and any OAuth paths you use).

### Phase 3 — Firebase (device tokens)

Registration uses **FCM on Android** and **APNs via Firebase on iOS**. You need a Firebase project even before server-side “send push” is implemented.

1. [Firebase console](https://console.firebase.google.com) → **Add project** (or use existing).
2. **Android app**
   - Package name must match Capacitor Android (`site.musicpromoai.app` after `cap add android` — confirm in `android/app/build.gradle`).
   - Download **`google-services.json`** → place in **`android/app/google-services.json`** (gitignored).
3. **iOS app**
   - Bundle ID must match **`site.musicpromoai.app`** (`capacitor.config.ts` → `appId`).
   - Download **`GoogleService-Info.plist`** → add to the iOS target in Xcode (gitignored).
4. **Cloud Messaging → Apple app configuration**
   - Upload your **APNs Authentication Key** (.p8) from Apple Developer → Keys, or use APNs certificates.
5. (Optional) **Service account** for server send → JSON stored later as Supabase secret `FCM_SERVICE_ACCOUNT_JSON`.

Without steps 2–4, the app may run but **push permission / registration** will fail on device.

### Phase 4 — Local machine (Mac for iOS)

**Prerequisites:** Node 22+, Xcode (iOS), Android Studio (Android), Apple Developer + Google Play accounts for store builds.

```bash
git clone <repo> && cd musicpromo-ai
git checkout main && git pull
npm ci
```

Create **`.env.local`** (never commit) with the **same** values as GitHub secrets:

```bash
VITE_SUPABASE_URL=https://YOUR_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
# Optional: VITE_GOOGLE_CLIENT_ID=...
```

Build and generate native shells **once per clone**:

```bash
npm run build
npx cap add ios
npx cap add android
```

Add Firebase files (Phase 3), then:

**iOS (Xcode)**

1. `npm run cap:ios`
2. Signing & Capabilities → select your **Team**, enable **Push Notifications**.
3. Confirm **Bundle Identifier** = `site.musicpromoai.app`.
4. Add **GoogleService-Info.plist** to the app target if not already.

**Android (Android Studio)**

1. `npm run cap:android`
2. Confirm `applicationId` = `site.musicpromoai.app`.
3. Ensure `google-services.json` is in `android/app/`.
4. Sync Gradle; use a physical device or emulator with Google Play services for push tests.

### Phase 5 — Build aligned with production

Every store build should match a **deployed** web commit:

```bash
git pull origin main
npm ci
npm run cap:sync    # runs build + cap sync
npm run cap:ios     # or cap:android → Run on device
```

**Alternative:** Actions → **Prepare native bundle** → download `capacitor-web-dist` → unzip into `dist/` → `npx cap sync` (skip local `npm run build` if you trust the artifact commit).

**Do not** use `CAP_SERVER_URL=https://musicpromoai.site` for App Store builds (that mode is for quick QA only).

### Phase 6 — Verify on a real device

1. Install debug/release build on phone.
2. Log in → app should request **notification permission** (`NativeAppBootstrap` → `syncNativePushRegistration`).
3. Supabase **Table Editor → `push_devices`** — row with your `user_id`, `platform`, and `token`.
4. **Launch digest** screen — **Weekly push** toggle appears only in the native app; toggling updates `users.push_digest_enabled`.
5. Log out → token should be removed via `unregisterPushToken` (best effort).

Push **delivery** for the weekly digest requires the roadmap FCM work in `sendLaunchDigest`; registration and preferences work without it.

### Phase 7 — Store release (manual)

1. Increment version in Xcode / `android/app/build.gradle`.
2. Archive (iOS) or **Build → Generate Signed Bundle** (Android).
3. Upload to **TestFlight** / **Play internal testing**.
4. Repeat Phase 5 after each `main` merge you ship to users.

### Phase 8 — OAuth (when you need social connect in-app)

Register **Universal Links** (iOS) and **App Links** (Android) for:

- `https://musicpromoai.site/auth/google/callback`
- Social OAuth return paths you use

Until then, some flows may work better in Safari than inside the WebView. See § OAuth / deep links below.

---

## Android from your phone only (no PC)

Use the **GitHub mobile app** or mobile browser for ops; **GitHub Actions** builds installable Android packages in the cloud.

### One-time setup (can all be done on phone)

| Step | Where | What |
|------|--------|------|
| 1 | Supabase app / browser | Run `supabase/migrations/20261004_native_push.sql` in SQL editor |
| 2 | Firebase console | Android app package **`site.musicpromoai.app`** → download **`google-services.json`** |
| 3 | GitHub → repo → **Settings → Secrets** | Add secrets below (use desktop site if the mobile UI hides Settings) |
| 4 | GitHub Actions (Play only) | **Generate Android upload keystore** — no Termux (see below) |

**GitHub repository secrets**

| Secret | Purpose |
|--------|---------|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Same as web Deploy (already set if Pages works) |
| `GOOGLE_SERVICES_JSON` | **Recommended without Termux:** paste the full Firebase `google-services.json` file |
| `GOOGLE_SERVICES_JSON_BASE64` | *Optional:* single-line base64 instead of raw JSON |

**Play release AAB only** (skip for personal debug installs):

| Secret | Purpose |
|--------|---------|
| `ANDROID_KEYSTORE_PASSWORD` | Password you choose (type in GitHub Settings) |
| `ANDROID_KEY_ALIAS` | e.g. `upload` |
| `ANDROID_KEY_PASSWORD` | Key password you choose |
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | Filled after keystore workflow (copy from artifact `.txt`) |

### Without Termux (recommended)

**Firebase → GitHub (no encoding)**

1. Firebase console → download **`google-services.json`** to your phone (Files / Drive).
2. Open the file in a text editor (Google Files, QuickEdit, iOS Files + tap to view text).
3. **Select all → Copy.**
4. GitHub → **Settings → Secrets → New secret** → name **`GOOGLE_SERVICES_JSON`** → paste entire JSON → Save.

The APK workflow accepts **`GOOGLE_SERVICES_JSON`** or **`GOOGLE_SERVICES_JSON_BASE64`** — you only need one.

**Play upload keystore → GitHub (no Termux, no PC)**

1. In GitHub Secrets, create **`ANDROID_KEYSTORE_PASSWORD`**, **`ANDROID_KEY_ALIAS`** (e.g. `upload`), and **`ANDROID_KEY_PASSWORD`** — pick passwords yourself in the browser.
2. **Actions → Generate Android upload keystore → Run workflow.**
3. Download artifacts:
   - **`android-upload-keystore`** — back up `upload.keystore` to Google Drive.
   - **`android-upload-keystore-base64`** — open the `.txt` file on your phone → copy the one line.
4. New secret **`ANDROID_UPLOAD_KEYSTORE_BASE64`** → paste that line.
5. Run **Build Android release AAB** when uploading to Play.

**Back up the keystore** — Play updates need the same upload key unless you reset it through Google.

**Other options (still no Termux)**

| Task | Option |
|------|--------|
| Paste JSON secret awkward on phone | Use GitHub **desktop site** in Chrome (“Request desktop site”) or any computer once |
| Base64 for JSON | Only if you prefer: a Play Store “file to base64” app, or paste file contents into a trusted encoder — **raw JSON secret is simpler** |
| Keystore | One `keytool` command on any borrowed PC, or the **Generate Android upload keystore** workflow above |

### Day-to-day: install the app on your phone

1. **GitHub** → **Actions** → **Build Android debug APK** → **Run workflow** → branch **`main`**.
2. Wait for green ✓ → open the run → **Artifacts** → **musicpromo-android-debug** → download **`app-debug.apk`**.
3. Open the APK from Downloads → **Install** (allow “install unknown apps” for Chrome/Files if asked).
4. Open **MusicPromo AI** → log in → allow **notifications**.
5. Supabase → **`push_devices`** should show your token.

Repeat after merges you want on device (each run builds fresh from `main`).

### Day-to-day: Google Play internal testing

1. **Actions** → **Build Android release AAB** → Run workflow.
2. Set **`version_code`** higher than your last Play upload (integer, e.g. `2`, `3`, …).
3. Download artifact **`musicpromo-android-release-aab`** → `app-release.aab`.
4. **Play Console** in browser → **Testing → Internal testing** → **Create release** → upload AAB.

You can create the Play app, add testers, and upload releases from the Play Console mobile site for many steps.

### What still needs a browser (not a PC)

- GitHub **Secrets** (first time)
- Supabase **SQL** and table checks
- Firebase **console**
- Play **Console** for store listing and review

You do **not** need Android Studio or a laptop for debug APKs or CI-built AABs once secrets exist.

Workflows: [APK](../.github/workflows/native-android-apk.yml), [AAB](../.github/workflows/native-android-aab.yml), [Generate keystore](../.github/workflows/native-android-keystore.yml).

### App icon and “category” on the phone

**Icon:** CI runs `scripts/apply-android-branding.sh`, which generates Android mipmaps from **`assets/icon.png`** (same brand mark as `public/musicpromo-ai-icon.svg`). Rebuild the APK after icon changes.

**Launcher grouping (Social / Music, etc.):** Android reads **`android:appCategory`** on the app (default **`social`** in CI). Some phones use this for app-drawer grouping; others ignore it. To prefer music grouping, set repository variable **`ANDROID_APP_CATEGORY`** = `audio` (allowed: `social`, `audio`, `video`, `game`, `news`, `maps`, `productivity`).

**Google Play store category** (what shoppers see) is **not** set in the APK — in **Play Console → Store settings → App category**, pick e.g. **Music & Audio** or **Social**, and add tags like *entertainment* / *music* in the store listing. That affects Play browse/search, not the home-screen icon file itself.

---

## How this fits GitHub Actions (recommended)

You already use **[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)** on every push to `main`. Treat native as a **second deliverable** from the same build, not a separate backend.

| What | Handled by | When |
|------|------------|------|
| **Web** (musicpromoai.site) | Deploy → **Frontend (GitHub Pages)** | Push to `main` when `src/`, `package.json`, `capacitor.config.ts`, etc. change |
| **Edge Functions** (incl. `registerPushToken`) | Deploy → **Supabase** | Push when `supabase/functions/**` changes |
| **Postgres schema** (`push_devices`, …) | **You** (Supabase SQL editor) | Once per migration file — Actions does **not** auto-run SQL yet |
| **Supabase secrets** (FCM, Resend, OpenAI) | **Supabase dashboard** | Not GitHub — see [GITHUB_DEPLOY.md](./GITHUB_DEPLOY.md) |
| **Android debug APK / release AAB** | **Build Android debug APK** / **Build Android release AAB** (`workflow_dispatch`) | After secrets + Firebase JSON; install APK from Artifacts on phone |
| **Store `.ipa`** | Mac + Xcode | iOS only |

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

## Google sign-in on Android (redirect_uri_mismatch)

Bundled Capacitor apps used to report origin **`https://localhost`**, so Google rejected login. The app now sets **`server.hostname: musicpromoai.site`** in `capacitor.config.ts` and uses the same redirect URI as the website.

**Google Cloud Console** (same **Web client** as `VITE_GOOGLE_CLIENT_ID`):

1. [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) → your **Web application** OAuth client.
2. **Authorized JavaScript origins** — include:
   - `https://musicpromoai.site`
3. **Authorized redirect URIs** — include **exactly**:
   - `https://musicpromoai.site/auth/google/callback`
4. Save. Wait a few minutes, then **rebuild the APK** (Actions → **Build Android debug APK**) and reinstall.

If you still see **redirect_uri_mismatch**, open the error screen or Logcat and note the URI Google shows — add that exact string to redirect URIs (no trailing slash unless the app sends one).

**Supabase:** Edge Function **`googleAuthExchange`** needs **`GOOGLE_LOGIN_CLIENT_SECRET`** (or `GOOGLE_CLIENT_SECRET`) for that same Web client.

## OAuth / deep links (social connect)

Register App Links for social callback paths when connecting Instagram/TikTok/YouTube inside the app. Google login uses the hostname + redirect URI above, not a separate scheme.

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
