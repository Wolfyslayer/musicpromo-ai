# MusicPromo AI — Expo (React Native)

Native client for the MusicPromo AI Supabase backend. **Not** a WebView wrap of the Vite SPA.

The web app remains at the repo root (`npm run dev`). See `../MOBILE_MIGRATION_PLAN.md`.

## Setup

```bash
cd mobile
cp .env.example .env
# Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
# (same values as web VITE_SUPABASE_* / .env.local)
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

## Auth & guest browse

- **Guests can browse** the app shell (Home / Campaigns / Artists / Analytics / Settings) without signing in — same idea as the web SPA. Creating, uploading, deleting, and loading private library data require sign-in (`requireAuth`).
- **Email/password** against Supabase Auth.
- **Google**: set `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (same Web client as `VITE_GOOGLE_CLIENT_ID`) for id_token → `signInWithIdToken`. If unset, falls back to Supabase `signInWithOAuth` — add `musicpromoai://auth/callback` under Supabase **Authentication → URL configuration → Redirect URLs**.
- Session restore on launch. Access token mirrored in SecureStore when size allows; full session in AsyncStorage.

Local seeded user (Cloud Agent DB): `cloudagent@example.com` / `password123`.

## Gaps vs web

Remotion MP4 encode, social *connect* OAuth (TikTok/YouTube/etc.), community, Stripe billing UI, artwork AI lab — still on web. Native previews exported HTTPS videos and manages campaigns/artists/uploads/audio.
