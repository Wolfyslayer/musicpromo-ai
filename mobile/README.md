# MusicPromo AI — mobile app (Expo)

React Native port of the web app in `../src`, built with Expo SDK 57, Expo Router and NativeWind v4.

```bash
cd mobile
npm install
cp .env.example .env      # EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (same project as the web app)
npx expo start            # scan the QR code with Expo Go, or press i / a for a simulator
```

- Conversion rules, library replacements and the native setup checklist: [MIGRATION.md](./MIGRATION.md).
- Video rendering runs on a server: see [../docs/VIDEO_RENDER_WORKER.md](../docs/VIDEO_RENDER_WORKER.md).
- Checks: `npx tsc --noEmit`, `npx expo-doctor`, `npx expo export --platform android`.
