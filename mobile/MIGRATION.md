# Web -> React Native migration guide

The web app lives in `../src` (Vite, React Router, Tailwind, shadcn/Radix). This folder is the Expo (SDK 57) port.
Route files in `src/app/**` are one-line re-exports of screens in `src/screens/*`; converted web pages go in `src/screens`.

## Conventions

- Styling: NativeWind v4 (`className`) with the same Tailwind tokens as the web app (`bg-background`, `text-muted-foreground`, `border-border`, `text-primary`, ...). Use `font-heading` / `font-heading-bold` (Space Grotesk) for headings. Body text uses the system font, so `font-medium`/`font-semibold`/`font-bold` work normally. Do NOT use the web-only `font-600`/`font-700` classes.
- Always render text through `@/components/ui/text` (`Text`). Never put bare strings inside `View`.
- Icons: `lucide-react-native` through `<Icon as={Plus} size={16} className="text-primary" />` from `@/components/ui/icon`.
- No hover/focus/`md:` desktop variants, no `grid` (use `flex-row flex-wrap` with width classes, or `FlatList numColumns`), no `space-x-*`/`space-y-*` (use `gap-*`), no `truncate` (use `numberOfLines={1}`), no CSS gradients (use `expo-linear-gradient`), no `animate-*` (use `react-native-reanimated`).
- Navigation: `expo-router` (`useRouter`, `useLocalSearchParams`, `Link`, `useFocusEffect`). Web `navigate("/campaigns/" + id)` -> `router.push(\`/campaigns/${id}\`)`. Query params (`?tab=plan`) are read with `useLocalSearchParams`. `window.location.href = x` -> `router.replace(x)`.
- Auth: `useAuth()` from `@/lib/AuthContext` has the same API as the web context (`requireAuth`, `isAuthenticated`, `user`, `logout`, ...). `useWorkspaceRefresh(reload)` still works. Guests may browse; premium actions call `requireAuth(cb)`.
- Data: `@/services/*` and `@/api/base44Client` (`db`) are the same JS modules as the web app and run unchanged. Use them as-is.
- Toasts: `toast({ title, description, variant })` from `@/components/ui/use-toast`.
- Forms: plain `useState`; `Input`/`Textarea`/`Select`/`Switch`/`Checkbox`/`Tabs`/`Dialog`/`Button` from `@/components/ui/*`. `Dialog variant="sheet"` replaces Radix Sheet/Drawer/Popover; `Select` replaces Radix Select/Dropdown; `Switch` takes `checked`/`onCheckedChange`.
- Files: web `<input type="file">` -> `expo-image-picker` (artwork) / `expo-document-picker` (audio). A picked file is represented as `{ uri, name, type }`; `uploadPromoAsset` in `@/services/supabaseStore` accepts it.
- Lists: prefer `FlatList` for long lists; wrap simple lists in `View`.
- Charts: `react-native-gifted-charts` replaces recharts. Colors that cannot use className come from `useThemeColors()` (`@/lib/theme`).
- Dates: `date-fns` + `@react-native-community/datetimepicker` (`DateField` helper in `@/components/ui/date-field`, if present) replace `<input type="date">`.
- Env: `process.env.EXPO_PUBLIC_*` replaces `import.meta.env.VITE_*`.

## Web-only libraries and their mobile replacements

| Web | Mobile |
| --- | --- |
| react-router-dom | expo-router |
| Radix UI / shadcn | components in `src/components/ui` (RN `Modal`, pickers) |
| tailwind (CSS vars) | NativeWind v4, same tokens in `src/global.css` |
| lucide-react | lucide-react-native |
| recharts | react-native-gifted-charts |
| sonner / radix toast | `use-toast` + `Toaster` |
| remotion (client render), @xenova/transformers worker | server-side rendering / transcription (see `supabase/functions/requestVideoRender`) |
| Web Audio API, `<audio>` | expo-audio |
| `<video>` | expo-video |
| localStorage | AsyncStorage |
| navigator.clipboard | expo-clipboard |
| Google OAuth redirect flow | Supabase OAuth + `expo-web-browser` (`signInWithGoogle` in `@/lib/supabaseAuth`) |

## Native setup checklist

1. Copy `.env.example` to `.env` and fill `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. In Supabase Auth -> URL configuration add the redirect URLs `promostudio://auth/callback` and `promostudio://reset-password` (plus the Expo Go URL printed by `npx expo start` while developing).
3. Social platform OAuth (Instagram/TikTok/YouTube) still completes on the existing hosted redirect pages; the app opens them in an in-app browser and refreshes the connection status on return.
