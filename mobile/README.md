# MusicPromo AI — Expo mobile app

Expo SDK 57 + Expo Router + NativeWind. Uses the **same Supabase project and services** as the Vite web app in the repo root.

## Production checklist (match web behavior)

1. **Merge/deploy the web app** from this branch so these routes exist on your live origin:
   - `/mobile-export-bridge` (free Remotion MP4 export)
   - `/mobile-lyrics-sync-bridge` (free on-device Whisper lyrics sync)
2. **Copy env from web → mobile** (`VITE_*` → `EXPO_PUBLIC_*`):

```bash
cd mobile
cp env.example .env
```

| Mobile | Web equivalent |
|--------|----------------|
| `EXPO_PUBLIC_SUPABASE_URL` | `VITE_SUPABASE_URL` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `VITE_SUPABASE_ANON_KEY` |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | `VITE_GOOGLE_CLIENT_ID` |
| `EXPO_PUBLIC_WEB_APP_URL` | Your published site origin (e.g. GitHub Pages URL) |
| `EXPO_PUBLIC_LYRICS_SYNC=web` | Default; same free Whisper as web |

3. **OAuth:** Register app scheme `musicpromo://` (and Expo dev redirect URLs) in Google Cloud, same client as web.
4. **Run:** `npm install && npm start`

## Parity with web

- **Screens:** Dashboard, campaigns (create/detail/content), studio/video, analytics, artists, releases (calendar/content), social hub/compose, settings, auth, legal — ported to `mobile/screens/`.
- **Export & lyrics:** Same client-side engines as web, via WebView bridges (no extra API cost by default).
- **UI:** NativeWind components instead of Radix/shadcn; behavior and data paths align with web.

See [docs/MOBILE_MIGRATION.md](../docs/MOBILE_MIGRATION.md) for details.
