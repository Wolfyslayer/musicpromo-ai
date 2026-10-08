# MusicPromo AI — React Native + Expo Migration Plan

> **Safety (Phase 17):** The Vite web app stays at the repo root (`src/`, `vite.config.js`, Capacitor). The native app lives in **`mobile/`**. Do not delete or gut the web app. Capacitor remains the existing WebView store path until Expo ships separately.

**Product:** MusicPromo AI — promo campaigns, artists, releases, Remotion video studio, social publishing, analytics, community, billing. Backend: **Supabase** (Auth, Postgres entities, Storage `music-promo-assets`, Edge Functions). Gateway: `src/api/base44Client.js` → `db.entities` / `db.auth` / `db.functions` / `db.integrations`.

---

## 1. Current architecture

| Layer | Location | Notes |
|-------|----------|--------|
| Vite + React 18 SPA | `src/` | Tailwind + shadcn/Radix UI |
| Routing | `react-router-dom` in `App.jsx` | Auth-aware routes + `ProtectedRoute` |
| Auth | `AuthContext` + `supabaseAuth` | Email/password, Google OAuth, OTP, password reset |
| Data | `services/data.js`, `supabaseStore.js` | Entity CRUD over Supabase tables |
| AI / billing / social | Edge Functions via `db.functions.invoke` | Local Cloud stack may omit Edge Functions |
| Video | Remotion + WebCodecs in-browser | See §11 / Phase 11 |
| Existing “native” | Capacitor wrapping `dist/` | **Not** this Expo migration target |

**Entities (Supabase):** `Artist`, `Song`, `Release`, `VideoProject` → `prepared_media`; `Campaign`, `CampaignDay`, `GeneratedContent` → `campaign_days`; `AnalyticsEntry`; `SocialAccount`; profile `users`.

---

## 2. Current routes / screens

### Public / auth
`/login`, `/register`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`, `/auth/google/callback`, `/auth/youtube/callback`

### Authenticated (Layout shell)
| Path | Screen |
|------|--------|
| `/` | Dashboard |
| `/campaigns` | Campaign list |
| `/create`, `/create/track` | Release campaign planner / redirect |
| `/campaigns/:id/*` | Plan, library, content, videos, analytics, song |
| `/campaigns/:id/video`, `/studio` | VideoGenerator |
| `/artwork` | Artwork studio |
| `/analytics` | Global analytics |
| `/artists`, `/artists/:id` | Artists + editor |
| `/releases/*` | Releases, editor, calendar, launch, album campaign |
| `/social/*` | Connect, health, queue, activity, compose |
| `/community`, `/community/genre/:slug` | Community |
| `/profile`, `/profile/:userId` | Profile |
| `/settings/*` | Account, billing, team, studio, preferences |

### Expo Router target (phone-first tabs + stacks)
```
mobile/app/
  (auth)/ login | register | forgot-password | reset-password
  (app)/
    (tabs)/ index | campaigns | artists | analytics | settings
    campaigns/create | campaigns/[id]/index|plan|videos|…
    video/index | video/[id]
    artists/[id]
```

**Migration order (Phase 18):** shell → auth → dashboard → campaign list → create → details → video → artists → analytics → settings. Extra web features (releases, social, community, artwork lab, billing deep UI) get reachable stubs or parity screens without silent removal — document gaps until ported.

---

## 3. Reusable components

| Keep concept / rewrite UI | Web-only (replace) |
|---------------------------|--------------------|
| CampaignCard, EmptyState, StatusBadge, ProgressBar, PageHeader, Logo, ConfirmDialog | Radix/shadcn (`components/ui/*`), Layout sidebar |
| ArtworkUpload / AudioUpload contracts | `<input type="file">`, HTML `<audio>` |
| Auth form fields patterns | AuthLayout DOM, AuthModal |

Native replacements: `View`/`Text`/`Pressable` + `mobile/src/components/ui/*` (Button, Card, Input, Screen, Text, …).

---

## 4. Reusable business logic

Port / adapt (prefer shared pure modules, RN-safe env):

- `services/data.js` — loadCampaigns, loadCampaign, loadArtists, deleteCampaign, …
- `services/supabaseStore.js` — entity API, `uploadPromoAsset`, `resolveAssetUrl`
- `services/constants.js`, `format.js`, `audioDisplay.js`
- `services/createCampaignCore.js` + AI/plan enrichment (needs Edge Functions)
- `lib/supabaseAuth.js` (replace `window.location` with Linking / Expo redirects)
- Pure helpers: `campaignNav`, `dayUxStatus`, `promoStylePresets`, etc.

Do **not** port Remotion compositions into RN as a fake renderer.

---

## 5. Reusable API / backend

- Same Supabase project, anon key, RLS, bucket paths `{userId}/artwork|audio|…`
- Same `db` facade shape for screens/hooks
- Edge Functions unchanged (AI, billing, social, support)
- Env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (mirror `VITE_*`)

---

## 6. Web-only code to replace

- `react-router-dom` → Expo Router
- DOM: `document`, `window.location`, `localStorage`/`sessionStorage` → SecureStore / AsyncStorage / Linking
- File inputs → `expo-image-picker` / `expo-document-picker`
- HTML audio / `AudioContext` → `expo-av` (Phase 10)
- Remotion Player / WebCodecs export → preview + backend/export status (Phase 11)
- Radix/Tailwind/framer-motion/recharts/html2canvas/jspdf/leaflet → RN equivalents or defer
- Capacitor Google Auth / push — later Expo AuthSession / notifications (out of first ship if blocking)

---

## 7. Tailwind / CSS → native design system

Web tokens (`index.css`): primary ~`hsl(265 88% 62%)`, accent magenta, light/dark surfaces, soft shadows, radius ~1rem, SF-like system fonts.

Native: `mobile/src/theme/{colors,spacing,typography,shadows}.ts` + StyleSheet UI primitives. **No NativeWind/Tailwind in RN screens** for this migration.

---

## 8. Browser APIs → native

| Browser | Native |
|---------|--------|
| `localStorage` (workspace) | SecureStore / AsyncStorage |
| `sessionStorage` (wizard) | in-memory / AsyncStorage |
| `navigator.clipboard` / `share` | `expo-clipboard` / `expo-sharing` |
| `matchMedia` / resize | `useWindowDimensions` |
| `visibilitychange` | AppState |
| OAuth redirect URL | `expo-auth-session` / `Linking` |
| Blob upload from `<input>` | picker URI → FormData / fetch / supabase-js File |

---

## 9. Native Expo modules (purposeful)

`expo-router`, `expo-secure-store`, `expo-image-picker`, `expo-document-picker`, `expo-file-system`, `expo-av`, `expo-image`, `expo-linking`, `expo-status-bar`, `react-native-safe-area-context`, `react-native-screens`, `@supabase/supabase-js`, `@tanstack/react-query`, `@react-native-community/netinfo` (Phase 16).

Optional later: `expo-video`, `expo-clipboard`, notifications.

---

## 10. Recommended Expo folder structure

```
mobile/
  app/                 # Expo Router only
  src/
    api/               # db client
    auth/              # AuthProvider, session restore
    components/ui/     # design system
    components/        # feature UI (uploads, cards, audio)
    constants/
    hooks/
    services/          # adapted from web (no DOM)
    theme/
    lib/               # query client, errors, network
  assets/
  app.json | app.config.js
  package.json
  tsconfig.json
  babel.config.js
  .env.example
```

No empty placeholder folders.

---

## 11. Dependencies

| Web | Mobile action |
|-----|----------------|
| vite, @vitejs/*, tailwind, postcss, react-dom, react-router-dom | Stay on **root** web only |
| Capacitor stack | Unchanged (separate path) |
| @supabase/supabase-js, @tanstack/react-query, zod, date-fns | Reuse in mobile |
| Remotion, three, recharts, radix, framer-motion | Not in mobile runtime |
| lucide-react | `@expo/vector-icons` / lucide-react-native if needed |

Root `package.json` scripts gain mobile aliases; web scripts unchanged.

---

## 12. Migration risks

1. **Remotion export is browser-only** — no native FFmpeg in-app; cloud/backend or deferred export.
2. **Edge Functions** missing on minimal local stacks → AI create/billing fail with clear errors.
3. **Google OAuth** needs Expo redirect URIs registered.
4. **Large surface area** — releases/social/community must not be deleted from web; mobile may lag with explicit gaps.
5. **Upload MIME/URI** differences on iOS/Android.
6. **Dual apps** — env duplication; document clearly.

---

## 13. Recommended migration order

Phases **1 → 20** below. Screen-by-screen (18) after Expo boots; verify after each major screen before the next.

---

## Phase checklist (1–20)

### Phase 1 — Audit
This document. No web deletions.

### Phase 2 — Expo Router structure
Auth stack + authenticated tabs/stacks matching real product areas.

### Phase 3 — SDK & tooling
Current stable Expo SDK; Expo-compatible deps; `app.config`; babel/metro/tsconfig; `EXPO_PUBLIC_*` env. Vite stays at root.

### Phase 4 — RN UI
No HTML tags in native screens.

### Phase 5 — Design system
colors / spacing / typography / shadows + Button, Card, Input, Screen, Text.

### Phase 6 — Routing & auth gate
Expo Router; unauthenticated users cannot open app tabs.

### Phase 7 — Real auth
Supabase email/password (+ register/reset); session restore; SecureStore-backed persistence; no fake auth.

### Phase 8 — API reuse
UI → hooks → services → Supabase; no mock campaign data.

### Phase 9 — Uploads
Artwork + audio (+ video file pick if present): pick, preview, upload, progress, cancel/fail/retry; same bucket contract.

### Phase 10 — Audio
`expo-av` play/pause/seek; playback state; unload on leave; no leaks.

### Phase 11 — Video
- **Keep** backend architecture: VideoProject entity, `render_output_url`, Edge AI clip functions, upload of finished assets.
- **Web Remotion + WebCodecs** remains the free on-device MP4 encoder for the SPA/Capacitor path.
- **Native:** preview existing exported HTTPS MP4s with `expo-av` / Video; show render status from API; **no fake MP4 generation**.
- **Incomplete renderer features are not removed** from web.
- **FFmpeg / server encode:** not in-repo today. If native export is required later, add a documented backend encoder (or keep using web Remotion). Documented gap until then.

### Phase 12 — Responsive mobile UX
Phone-first; safe areas; KeyboardAvoidingView; FlatList/ScrollView (avoid nested ScrollViews); bottom tabs; 44pt+ targets; loading/empty/error; long text truncation; landscape where needed.

### Phase 13 — Accessibility
`accessibilityLabel` / `role` / hints; don’t rely on color alone for status.

### Phase 14 — State
Keep Auth context + React Query (RN config: refetchOnReconnect, no window focus). No new state library unless necessary. Avoid duplicate server state.

### Phase 15 — Error handling
User-facing messages + `console` logs for auth, network, pickers, upload, playback, video, CRUD. Never swallow silently.

### Phase 16 — Network
NetInfo awareness; retry UI; preserve form drafts; disable duplicate submits while in-flight.

### Phase 17 — Migration safety
Web app preserved at root. Native in `mobile/`. Before any delete: verify replacement works. Never delete unmigrated web features.

### Phase 18 — Screen-by-screen
Order: shell → auth → home → campaign list → create → details → video → artists → analytics → settings. After each: typecheck / Expo run / nav & styling sanity.

### Phase 19 — Testing
Auth flows; campaigns CRUD+refresh; nav reachability; file pick/upload fail/retry; video open/preview/save/export **state**; every screen reachable.

### Phase 20 — Final cleanup
Remove only unused **mobile** deps; hunt DOM/Tailwind/react-router in `mobile/`; `npx tsc --noEmit` + `npx expo export` / start; fix blockers.

---

## Coding rules (enforced)

No fake functionality; no silent feature removal; no unnecessary backend rewrite; no WebView shortcut for this app; no blind 1:1 DOM conversion; no Tailwind-in-native; no unnecessary deps; no hardcoded secrets; separate business logic from UI; reusable native components; preserve branding + API contracts; phone-usable; fix errors as they appear.

---

## How to run

```bash
# Web (unchanged)
npm run dev

# Native Expo
cd mobile
cp .env.example .env   # set EXPO_PUBLIC_SUPABASE_*
npm install
npx expo start
npx expo export        # static/web export check for Expo
```

Local Cloud Agent Supabase (when started): same URL/anon key as web `.env.local`, mapped to `EXPO_PUBLIC_*`.

Test account (local seeded DB): `cloudagent@example.com` / `password123`.

---

## Implementation status (this PR)

| Phase | Status | Notes |
|-------|--------|-------|
| 1 Audit + plan | Done | This file + `docs/mobile-migration-plan.md` in Project store |
| 2–3 Expo structure + SDK 57 | Done | `mobile/` Expo Router app; web untouched at repo root |
| 4–5 RN UI + design system | Done | Theme tokens + Button/Card/Input/Screen/Text |
| 6 Auth gate | Done | Guest browse like web: `(app)` open without login; writes use `requireAuth` → login |
| 7 Real auth | Done | Email/password + **Google** (`expo-auth-session` id_token or Supabase OAuth); register/reset; session restore |
| 8 API reuse | Done | `db` gateway + `data` / `supabaseStore` adapted for RN |
| 9 Uploads | Done | Artwork (image-picker) + audio (document-picker) + progress/cancel/retry |
| 10 Audio | Done | `expo-audio` play/pause/seek; unload via replace/unmount |
| 11 Video | Done (preview) | Native preview of exported HTTPS MP4; Remotion encode stays on web; **no fake MP4**; FFmpeg/backend encode documented as future |
| 12–13 UX + a11y | Done (baseline) | Safe areas, KAV, bottom tabs, labels/roles, 44pt targets |
| 14 State | Done | Auth context + TanStack Query (RN options) |
| 15–16 Errors + network | Done | ErrorBanner/logs; NetInfo offline banner; submit guards |
| 17 Safety | Done | Web SPA preserved; native in `mobile/` only |
| 18 Screen order | Done | Shell → auth → home → campaigns → create → detail → video → artists → analytics → settings |
| 19 Testing | Partial | `tsc --noEmit` + `expo export` green; device E2E needs Supabase env |
| 20 Cleanup | Done | Deprecated `expo-av` removed; no Tailwind/react-router in `mobile/` |

## Remaining gaps

- Full Remotion editor / on-device MP4 encode (web Remotion / future backend FFmpeg)
- Social OAuth deep links, community, Stripe billing UI, artwork AI lab depth
- Google: uses the **same web auth pipeline** (`registerGoogleOAuthPkce` + `googleAuthExchange` + redirect `https://musicpromoai.site/auth/google/callback`). Set `EXPO_PUBLIC_GOOGLE_CLIENT_ID` = `VITE_GOOGLE_CLIENT_ID`.
- Push notifications via Expo
- Releases / launch board full parity screens
- AI campaign plan generation on device (Edge Function — same as web; create flow saves draft entities)

These remain on web until explicitly ported; mobile never pretends they succeeded.
