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
| Client Remotion encode (WebCodecs) | **WebView bridge** to `/mobile-export-bridge` on `EXPO_PUBLIC_WEB_APP_URL` (same Remotion pipeline as web), or MP4 upload |
| AI lyrics sync | **Edge Function `transcribeLyrics`** (OpenAI Whisper) — same grouped cues as web |
| `@xenova/transformers` | Replaced by server Whisper on mobile (no on-device model) |

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

The backend still stores **client-rendered** MP4 URLs. On mobile, **Export MP4**:

1. Tries native Remotion (only in web builds).
2. Automatically opens an in-app **WebView** to `{EXPO_PUBLIC_WEB_APP_URL}/mobile-export-bridge?projectId=…`, which runs the same `videoService.exportVideo` + Remotion path as the browser, then returns the public MP4 URL to the app.
3. Or **Upload MP4** / use Create Campaign’s render step with the same bridge.

Deploy **`transcribeLyrics`** Edge Function (requires `OPENAI_API_KEY` in Supabase secrets) for AI lyrics sync on device.

## Web → route map

| Web | Expo |
|-----|------|
| `/` | `/(main)/(tabs)/` |
| `/studio`, `/campaigns/:id/video` | `VideoGeneratorScreen` |
| `/login` … `/reset-password` | `/login` … `/reset-password` |
| Other app routes | Same paths under `/(main)/…` |

Web app in repo root is unchanged; ship both clients against one Supabase project.
