# MusicPromo AI — Expo (React Native)

Native client for the MusicPromo AI Supabase backend. **Not** a WebView wrap of the Vite SPA.

The web app remains at the repo root (`npm run dev`). See `../MOBILE_MIGRATION_PLAN.md`.

## Setup

```bash
# From repo root — copy web env into Expo (preferred)
npm run mobile:sync-env

# Or manually:
cd mobile
cp .env.example .env
# Set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,
# EXPO_PUBLIC_GOOGLE_CLIENT_ID (= web VITE_* values)

npm install
npx expo start
```

From repo root: `npm run mobile:start`

## Scripts

| Command | Purpose |
|---------|---------|
| `npx expo start` | Dev server |
| `npm run lint` / `npx tsc --noEmit` | Typecheck |
| `npx expo export` | Static export check |
| `npm run mobile:sync-env` (repo root) | Write `mobile/.env` from root `.env.local` |
| `npm run mobile:oauth-doctor` (repo root) | Validate Google OAuth env + probe Edge Functions |

## Auth & guest browse

- **Guests can browse** the app shell (Home / Campaigns / Artists / Analytics / Settings) without signing in — same idea as the web SPA. Creating, uploading, deleting, and loading private library data require sign-in (`requireAuth`).
- **Email/password** against the same Supabase Auth project as web.
- **Google** uses the **same web pipeline**: PKCE → `registerGoogleOAuthPkce` → Google authorize → `https://musicpromoai.site/auth/google/callback` → `googleAuthExchange` → `signInWithIdToken`. Set `EXPO_PUBLIC_GOOGLE_CLIENT_ID` to the same value as `VITE_GOOGLE_CLIENT_ID`. No separate Expo OAuth client or `musicpromoai://` redirect required for Google.
- Confirm / reset emails point at the public site (`EXPO_PUBLIC_APP_ORIGIN`, default `https://musicpromoai.site`).
- Session restore on launch. Access token mirrored in SecureStore when size allows; full session in AsyncStorage.

### Local Google OAuth

The local Supabase stack does **not** run Edge Functions. For Google sign-in on a simulator/device:

1. Put hosted `VITE_SUPABASE_*` + `VITE_GOOGLE_CLIENT_ID` in root `.env.local`
2. `npm run mobile:sync-env` then `npm run mobile:oauth-doctor`
3. Ensure Google Cloud has redirect `https://musicpromoai.site/auth/google/callback`
4. Restart Expo and use **Continue with Google**

Full checklist: [`docs/GOOGLE_SIGNIN.md`](../docs/GOOGLE_SIGNIN.md) § Local Expo testing.

Local seeded user (Cloud Agent DB, email/password only): `cloudagent@example.com` / `password123`.

## Gaps vs web

Remotion MP4 encode, social *connect* OAuth (TikTok/YouTube/etc.), community, Stripe billing UI, artwork AI lab — still on web. Native previews exported HTTPS videos and manages campaigns/artists/uploads/audio.
