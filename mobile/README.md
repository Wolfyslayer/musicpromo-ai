# MusicPromo AI mobile

Expo SDK app for the MusicPromo studio. The Vite web app stays at the repository root.

## Run

```bash
cd mobile
npm install
cp env.example .env
npm run web
```

Put the same Supabase project URL and anon key used by the web app into `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

Google sign-in and password reset use the app scheme `musicpromo`. Add these redirect URLs in Supabase:

- `musicpromo://auth/google/callback`
- `musicpromo://reset-password`
- The Expo web origin you use locally, for example `http://localhost:8081/auth/google/callback`

## What is included

Auth, dashboard, campaigns, artists, releases, social connect/compose, settings, analytics, the YouTube OAuth callback, and the public privacy and terms pages. Guests stay on the current screen and sign in from the same login sheet the website uses.

Studio rendering, artwork analysis, and lyrics sync run on the device. They use the same free Remotion WebCodecs renderer and the free `Xenova/whisper-tiny` model as the website. No paid render API is involved. The renderer is prebuilt at `assets/engine/studio.bundle` from `engine/entry.js`. Rebuild it from the repository root after renderer changes:

```bash
npx esbuild mobile/engine/entry.js --bundle --format=iife --platform=browser --target=es2022 --jsx=automatic --outfile=mobile/assets/engine/studio.bundle --define:process.env.NODE_ENV=\"production\"
```

Encoding needs WebCodecs. That works in Chrome, Firefox, and current Android Chrome. iOS WebKit has the same limitation as the website and will report that the browser cannot encode.

Analytics includes platform totals, views over time, engagement over time, and a content-type breakdown. Sync uses the existing `socialStatsSync` function.
