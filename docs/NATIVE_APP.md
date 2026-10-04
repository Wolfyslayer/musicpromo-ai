# Native iOS / Android (Capacitor)

The web app ships inside **Capacitor** for App Store / Play Store builds. **One codebase** — `npm run build` output in `dist/` is copied to native projects.

## First-time setup (on your Mac for iOS, any OS for Android)

1. Install deps: `npm install`
2. Build web assets: `npm run build`
3. Add platforms (once per clone):
   ```bash
   npx cap add ios
   npx cap add android
   ```
4. Sync after every web release:
   ```bash
   npm run cap:sync
   ```
5. Open IDE:
   ```bash
   npm run cap:ios
   npm run cap:android
   ```

`ios/` and `android/` are generated locally (gitignored). Commit only if your team wants CI to build from repo.

## Supabase (push + auth)

Run in SQL editor:

- **`supabase/migrations/20261004_native_push.sql`** — `push_devices`, `users.push_digest_enabled`

Deploy Edge Functions:

```bash
supabase functions deploy registerPushToken unregisterPushToken
```

## Firebase Cloud Messaging (push)

1. Create a [Firebase](https://console.firebase.google.com) project.
2. Add **iOS** app → upload **APNs key** in Firebase Cloud Messaging.
3. Add **Android** app → download `google-services.json` into `android/app/`.
4. For iOS, add `GoogleService-Info.plist` to the Xcode project (Capacitor Firebase docs).
5. Store Firebase **service account JSON** in Supabase secrets as `FCM_SERVICE_ACCOUNT_JSON` (Phase 3 — weekly push sender; registration works without it).

The app registers device tokens on sign-in via **`registerPushToken`**. Users toggle **Weekly push** on the launch digest panel (native app only). Email digest toggle is unchanged.

## OAuth / deep links

Register Universal Links / App Links for:

- `https://musicpromoai.site/auth/google/callback`
- Social OAuth callback paths

Use **`@capacitor/browser`** for provider login when native flows need the system browser (future hardening).

## Dev against production URL

```bash
CAP_SERVER_URL=https://musicpromoai.site npm run cap:sync
```

Uses live site inside the WebView (internal testing only).

## What’s next (not in this PR)

- Extend **`sendLaunchDigest`** cron to send FCM messages when `push_digest_enabled` is true.
- Deep-link payload `{ "route": "/campaigns" }` on notification tap (listener wired in `pushNotifications.js`).
