# MusicPromo AI — mobile app (Expo)

React Native port of the web app in `../src`, built with Expo SDK 57, Expo Router and NativeWind v4.

```bash
cd mobile
npm install
cp .env.example .env      # EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (same project as the web app)
npx expo start            # scan the QR code with Expo Go, or press i / a for a simulator
```

- Conversion rules, library replacements and the native setup checklist: [MIGRATION.md](./MIGRATION.md).
- Video rendering and lyric sync run free on the phone: a hidden WebView loads the deployed web app's headless page (`/?mobile-render=1`) and uses its Remotion/WebCodecs and Whisper pipeline. Set `EXPO_PUBLIC_WEB_APP_URL` to the deployed web app.
- Checks: `npx tsc --noEmit`, `npx expo-doctor`, `npx expo export --platform android`.
