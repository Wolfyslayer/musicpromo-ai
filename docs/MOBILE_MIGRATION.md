# React Native / Expo migration

The web app lives in `src/` (Vite + React Router + Tailwind + shadcn/Radix). The Expo app lives in `mobile/` (Expo SDK 57 + Expo Router + NativeWind).

## Status (phase 1 — foundation)

| Task | Status |
|------|--------|
| Expo project + Expo Router | Done (`mobile/`) |
| `@supabase/supabase-js`, AsyncStorage, URL polyfill | Done |
| Supabase client with AsyncStorage | `mobile/lib/supabaseClient.ts` |
| Route map matching web `App.jsx` | Done (placeholders for most screens) |
| Auth screens (email/password) | Done |
| Dashboard (simplified) | Done |
| Full UI port (~166 web files) | **Needs your approval** |

## Run the mobile app

```bash
cd mobile
cp .env.example .env   # set EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
npm start
```

Use the same Supabase project as the web app (`VITE_*` → `EXPO_PUBLIC_*`).

## Web → mobile route map

| Web (react-router) | Expo Router |
|--------------------|-------------|
| `/` | `/(main)/(tabs)/` |
| `/studio` | `/(main)/(tabs)/studio` |
| `/social` | `/(main)/(tabs)/social` |
| `/analytics` | `/(main)/(tabs)/analytics` |
| `/login` … `/reset-password` | `/login` … `/reset-password` |
| `/campaigns`, `/campaigns/:id`, … | `/(main)/campaigns/...` |
| `/releases/...` | `/(main)/releases/...` |
| `/artists`, `/artists/:id` | `/(main)/artists/...` |
| `/settings` | `/(main)/settings` |
| `/social/compose` | `/(main)/social/compose` |

## Styling

Web uses **Tailwind CSS** + CSS variables in `src/index.css`. Mobile uses **NativeWind 4** with a subset of design tokens in `mobile/tailwind.config.js`. Dark mode parity is not wired yet (`next-themes` is web-only).

## Web-only dependencies — approval needed

Before porting the rest of the app, choose mobile strategies for:

| Web package | Used for | Suggested mobile approach |
|-------------|----------|---------------------------|
| `@radix-ui/*`, `vaul`, `cmdk` | shadcn UI | `@rn-primitives/*` or custom RN components (partial start in `mobile/components/ui/`) |
| `remotion`, `@remotion/*` | Video studio | Server-side render only + `expo-av` preview, or defer Studio tab |
| `recharts` | Analytics charts | `victory-native` or `react-native-gifted-charts` |
| `react-leaflet` | Maps | `react-native-maps` or drop maps on mobile |
| `@stripe/react-stripe-js` | Payments | `@stripe/stripe-react-native` |
| `react-quill-new` | Rich text | `@10play/tentap-editor` or plain `TextInput` |
| `@hello-pangea/dnd` | Drag-and-drop | `react-native-draggable-flatlist` |
| `@xenova/transformers` | On-device ML | Not viable on mobile; keep AI on Edge Functions |
| `html2canvas`, `jspdf` | Exports | Server-side PDF/image generation |
| `framer-motion` | Animations | `react-native-reanimated` |
| `lucide-react` | Icons | `lucide-react-native` (already used in mobile) |
| Google custom OAuth (`googleAuth.js`) | Sign-in | `expo-auth-session` + deep link to `musicpromo://` |
| Social OAuth flows | Meta/TikTok/YouTube | Same as web but WebBrowser + app scheme callbacks |

## Shared logic

These modules were copied/adapted and work with the mobile Supabase client:

- `mobile/services/supabaseStore.js`
- `mobile/services/data.js`
- `mobile/services/studioRecords.js`
- `mobile/api/db.ts`

Upload helpers still expect web `File`/`Blob`; mobile uploads need `expo-document-picker` + `fetch(uri).blob()` — approve before porting ArtworkUpload / AudioUpload.

## Next steps (after approval)

1. **UI kit** — Port shadcn primitives or adopt `@rn-primitives`.
2. **Phase screens** — Campaigns → Releases → Social (by business priority).
3. **Google + social OAuth** — Wire `expo-auth-session` to existing Edge Functions.
4. **Studio** — Decide server-render-only vs deferred feature.
5. **Monorepo (optional)** — Extract `services/` + types to `packages/shared` for one source of truth.

Please reply with:

- Which features must ship in v1 mobile (e.g. Dashboard + Campaigns only)?
- Approved replacements for video, charts, and rich text?
- OK to use NativeWind for all ported screens?
- App scheme / bundle IDs (`musicpromo`?) for OAuth redirect URIs?
