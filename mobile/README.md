# MusicPromo AI — mobile app

React Native port of the web app in the repository root, built with Expo SDK 57, Expo Router and NativeWind.
It talks to the same Supabase project (tables, Storage bucket `music-promo-assets`, Edge Functions) as the web app.

## Setup

```bash
cd mobile
npm install
cp .env.example .env.local   # fill in EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start
```

Optional: `EXPO_PUBLIC_WEB_APP_URL` (e.g. `https://musicpromoai.site`) enables the "Open web studio" button for MP4 export.

The app uses native modules beyond Expo Go's set only through Expo packages, so Expo Go works for most screens.
Use a development build (`npx expo run:ios` / `npx expo run:android` or `npx eas-cli@latest build --profile development`) for
OAuth deep links with the `musicpromo://` scheme.

## Checks

```bash
npm run lint        # expo lint
npm run typecheck   # tsc --noEmit
npm run doctor      # expo-doctor
npx expo export --platform ios   # bundle check
```

## Supabase configuration for mobile

Add these redirect URLs under Supabase Auth → URL Configuration (scheme from `app.json`):

- `musicpromo://` — email confirmation and Google sign-in
- `musicpromo://reset-password` — password recovery
- `musicpromo://social` — return from Instagram / TikTok / YouTube connect

During development with Expo Go the URLs look like `exp://<lan-ip>:8081/--/reset-password`; add those too if you test there.

Google sign-in on mobile uses Supabase's Google provider (`signInWithOAuth` in an auth session browser) rather than the web app's
custom `/auth/google/callback` page.

## Structure

- `src/app/` — Expo Router routes only (thin re-exports). URLs match the web routes.
  - `(app)/(tabs)/` — bottom tabs: Dashboard, Campaigns, Releases, Social, Settings
  - `(app)/…` — stack screens: create, studio, analytics, artists, campaign and release detail screens, social compose
  - `(auth)/` — login, register, forgot/reset password (presented as a modal)
- `src/screens/` — screen components ported from `../src/pages`
- `src/components/ui/` — React Native replacements for the shadcn/Radix primitives
- `src/services/`, `src/api/db.js` — data layer shared in shape with the web app (`db` gateway over Supabase)
- `src/lib/supabaseClient.js` — Supabase client persisting the session in AsyncStorage

## Differences from the web app

- MP4 rendering (Remotion + WebCodecs), in-browser audio analysis (Web Audio) and Whisper lyric sync (Transformers.js) are web-only.
  The mobile studio edits and saves the same video projects, previews natively and plays finished renders.
- Charts use `react-native-gifted-charts` instead of `recharts`.
