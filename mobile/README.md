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

## Auth

Email/password against Supabase Auth. Session restore on launch. Access token mirrored in SecureStore when size allows; full session in AsyncStorage.

Local seeded user (Cloud Agent DB): `cloudagent@example.com` / `password123`.

## Gaps vs web

Remotion MP4 encode, social OAuth deep links, community, Stripe billing UI, artwork AI lab — still on web. Native previews exported HTTPS videos and manages campaigns/artists/uploads/audio.
