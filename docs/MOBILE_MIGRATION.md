# React Native / Expo migration

The web app lives in `src/` (Vite + React Router + Tailwind + shadcn/Radix). The Expo app lives in `mobile/` (Expo SDK 57 + Expo Router + NativeWind).

## Cost model (stay free like web)

Mobile does **not** introduce new paid services by default.

| Feature | Web | Mobile (default) |
|---------|-----|------------------|
| Supabase auth + DB | Free tier / your project | Same |
| Promo MP4 export | Free **client-side Remotion** (WebCodecs) | Same code via **WebView bridge** to your hosted web app — no encode API fees |
| AI lyrics sync | Free **on-device Whisper** (`@xenova/transformers`) | Same worker via **`/mobile-lyrics-sync-bridge`** WebView — no per-sync API fee |
| Campaign AI copy / analyze | Optional **`OPENAI_API_KEY`** on Edge Functions (same as web) | Same `db.functions.invoke` — only if you already use AI on web |
| Lyrics via OpenAI API | Not used on web | **Opt-in only:** `EXPO_PUBLIC_LYRICS_SYNC=openai` + deploy `transcribeLyrics` |

**One URL ties it together:** deploy the web app once, set `EXPO_PUBLIC_WEB_APP_URL` in mobile `.env`. Mobile then reuses your **free** browser engines inside a WebView (export + lyrics), matching web behavior.

No extra SaaS is required beyond what you already use for the web app (Supabase + optional OpenAI for AI features you enable on web).

## Status

| Area | Status |
|------|--------|
| Expo + Expo Router + NativeWind | Done |
| Supabase (AsyncStorage session) | Done |
| Auth (email, Google PKCE, reset password, OTP register) | Done |
| All major screens ported | Done |
| Remotion export | WebView → `/mobile-export-bridge` (free client render) |
| Lyrics sync | WebView → `/mobile-lyrics-sync-bridge` (free Whisper worker) |

## Run

```bash
cd mobile
cp env.example .env
npm install
npm start
```

Map env vars: `VITE_SUPABASE_*` → `EXPO_PUBLIC_SUPABASE_*`, `VITE_GOOGLE_CLIENT_ID` → `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.

## Required for full parity (still free)

1. **Publish / host the web app** (same as today) so these routes exist:
   - `/mobile-export-bridge`
   - `/mobile-lyrics-sync-bridge`
2. Set **`EXPO_PUBLIC_WEB_APP_URL`** to that origin in `mobile/.env`.

Manual fallbacks without the URL: type lyrics, import SRT, upload a finished MP4.

## Optional (paid API, same as enabling extra OpenAI usage on web)

- `EXPO_PUBLIC_LYRICS_SYNC=openai` + deploy `supabase/functions/transcribeLyrics` if you cannot host the web bridge but want server Whisper.

## Web → route map

| Web | Expo |
|-----|------|
| `/` | `/(main)/(tabs)/` |
| `/studio`, `/campaigns/:id/video` | `VideoGeneratorScreen` |
| `/login` … `/reset-password` | `/login` … `/reset-password` |
| Other app routes | Same paths under `/(main)/…` |

Web + mobile share one Supabase project; the web bundle is the **free compute** layer for Remotion and Whisper on phones.
