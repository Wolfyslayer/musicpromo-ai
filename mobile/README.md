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

Auth, dashboard, campaigns, artists, releases, social connect/compose, settings, analytics, and the public privacy and terms pages. Navigation follows the web routes.

Studio video rendering (Remotion) and on-device lyrics sync are not included. Analytics charts use Victory Native on iOS and Android.
