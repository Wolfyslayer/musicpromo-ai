# React Native / Expo migration

The web app lives in `src/` (Vite + React Router + Tailwind + shadcn/Radix). The Expo app lives in `mobile/` (Expo SDK 57 + Expo Router + NativeWind).

## Status

| Area | Status |
|------|--------|
| Expo + Expo Router + NativeWind | Done |
| Supabase (AsyncStorage session) | Done |
| Auth (email, Google PKCE, reset password) | Done |
| Dashboard, Campaigns, Create, Detail, Content | Done |
| Artists, Releases (full sub-routes) | Done |
| Social Hub + Compose + OAuth (WebBrowser) | Done |
| Analytics (`react-native-gifted-charts`) | Done |
| Settings (AsyncStorage prefs) | Done |
| Video Studio (native editor + `expo-av` preview + MP4 upload / optional WebView) | Done |
| Privacy & Terms | Done |
| Client Remotion encode (WebCodecs) | **Web only** — mobile uploads MP4 or uses `EXPO_PUBLIC_WEB_APP_URL` studio |
| On-device lyrics Whisper sync | **Web only** — manual lyrics on mobile |
| `@xenova/transformers` | **Not on mobile** — AI stays on Edge Functions |

## Run

```bash
cd mobile
cp env.example .env
npm install
npm start
```

Map env vars from the web app: `VITE_SUPABASE_*` → `EXPO_PUBLIC_SUPABASE_*`, `VITE_GOOGLE_CLIENT_ID` → `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.

Register OAuth redirect URIs for the native app scheme `musicpromo://` (and Expo dev URLs) in Google Cloud alongside your web callback.

## Architecture

- **Screens:** `mobile/screens/*` — ported from `src/pages/*`
- **UI:** `mobile/components/ui/*` + campaign/social components (NativeWind)
- **Data:** `mobile/services/*` shared logic with web (Supabase entities)
- **API:** `mobile/api/db.ts` — same shape as web `base44Client`

## Video export on mobile

The Supabase backend stores **client-rendered** MP4 URLs only. On mobile:

1. Edit project in **Studio** tab and save metadata.
2. **Export** tries Remotion (succeeds on web export builds only); otherwise upload an MP4 or open **Web Studio** when `EXPO_PUBLIC_WEB_APP_URL` is set.

## Web → route map

| Web | Expo |
|-----|------|
| `/` | `/(main)/(tabs)/` |
| `/studio`, `/campaigns/:id/video` | `VideoGeneratorScreen` |
| `/login` … `/reset-password` | `/login` … `/reset-password` |
| Other app routes | Same paths under `/(main)/…` |

Web app in repo root is unchanged; ship both clients against one Supabase project.
