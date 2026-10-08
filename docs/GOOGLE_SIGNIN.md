# Google sign-in (your domain, free Supabase plan)

Google shows **“Continue to musicpromoai.site”** instead of `*.supabase.co` by using your site as the OAuth redirect URI and exchanging the code in an Edge Function, then `signInWithIdToken` for the Supabase session.

## 1. Google Cloud Console

Use the **same OAuth client** as YouTube/social (or create a **Web application** client).

**Authorized JavaScript origins**

- `https://musicpromoai.site`
- `http://localhost:5173` (local dev)

**Authorized redirect URIs** (add all that apply)

- `https://musicpromoai.site/auth/google/callback` (sign-in)
- `https://musicpromoai.site/auth/youtube/callback` (Connect YouTube — shows **musicpromoai.site** on Google’s account screen)
- `http://localhost:5173/auth/google/callback`
- `http://localhost:5173/auth/youtube/callback`

Do **not** remove `https://<project-ref>.supabase.co/auth/v1/callback` unless you fully stop using Supabase-hosted Google OAuth elsewhere.

**OAuth consent screen:** app name **MusicPromo AI**, authorized domain `musicpromoai.site`.

## 2. Supabase

**Authentication → Providers → Google**

- Enable Google
- **Client ID** and **Client secret** — same as Google Cloud
- (Optional) Skip nonce checks if you see nonce errors — only if Supabase offers it for your project

**Authentication → URL configuration**

- Site URL: `https://musicpromoai.site`
- Redirect URLs: `https://musicpromoai.site/**`

**Edge Function secrets** for **login** (can be the same Web client as YouTube, or a separate one):

- `GOOGLE_CLIENT_SECRET` — client secret for the **same** Web client as `VITE_GOOGLE_CLIENT_ID`
- Optional alias: `GOOGLE_LOGIN_CLIENT_SECRET` (use if `YOUTUBE_CLIENT_SECRET` belongs to a different OAuth client)

You do **not** need `GOOGLE_CLIENT_ID` in secrets when the app sends `VITE_GOOGLE_CLIENT_ID`; token exchange uses the app’s public client ID + the secret above.

Deploy: `googleAuthExchange` (or full `supabase functions deploy`).

## 3. GitHub Actions / production build

**Settings → Secrets and variables → Actions → Variables**

| Variable | Value |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Same Web client ID as above (public) |

Redeploy frontend after setting.

Local `.env.local`:

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## Flow

1. User clicks **Continue with Google** → browser goes to Google with `redirect_uri=https://musicpromoai.site/auth/google/callback`
2. Google returns to your SPA → `GoogleAuthCallback` calls Edge Function `googleAuthExchange`
3. Client calls `supabase.auth.signInWithIdToken({ provider: 'google', token: id_token })`

## 4. Local Expo testing (same Google pipeline as web)

Expo reuses the **web** Web client + redirect + Edge Functions. There is no separate Expo OAuth client and no `musicpromoai://` Google redirect.

**Important:** the local Cloud Agent Supabase stack (Postgres/Auth/REST only) does **not** run Edge Functions. Point Expo at your **hosted** Supabase project where `registerGoogleOAuthPkce` and `googleAuthExchange` are deployed.

### One-time checklist

1. **Google Cloud** (Web application client — same as production web):
   - Authorized redirect URI: `https://musicpromoai.site/auth/google/callback` (required; Expo captures this URL in the in-app browser)
   - Optional for web SPA only: `http://localhost:5173/auth/google/callback`
2. **Hosted Supabase**
   - Auth → Google enabled with that Client ID + secret
   - Secrets: `GOOGLE_CLIENT_SECRET` or `GOOGLE_LOGIN_CLIENT_SECRET`
   - Deploy: `registerGoogleOAuthPkce`, `googleAuthExchange` (`verify_jwt = false` in `supabase/config.toml`)
3. **Root `.env.local`** (web values):

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

4. **Sync into Expo and verify functions:**

```bash
npm run mobile:sync-env          # writes mobile/.env from root .env.local
npm run mobile:oauth-doctor      # checks env + probes Edge Functions
cd mobile && npx expo start
```

| Env (Expo) | Source (web) |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `VITE_SUPABASE_URL` (hosted) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `VITE_SUPABASE_ANON_KEY` |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | `VITE_GOOGLE_CLIENT_ID` |
| `EXPO_PUBLIC_APP_ORIGIN` | defaults to `https://musicpromoai.site` |

Restart Expo after changing `mobile/.env`. Settings → Auth shows whether the Google client ID is set and the redirect URI in use.

### Flow on device / simulator

1. Tap **Continue with Google** → system browser / auth session
2. Google redirects to `https://musicpromoai.site/auth/google/callback?code=…`
3. Expo dismisses the session with that URL (page need not fully load in the app)
4. App calls `googleAuthExchange` → `signInWithIdToken`

## Troubleshooting

| Issue | Fix |
| --- | --- |
| **Edge Function returned a non-2xx** | Open the error text after the fix deploy — usually Google token exchange. See rows below. |
| **The OAuth client was not found** | `GOOGLE_CLIENT_SECRET` must belong to the **same** Web client as **`VITE_GOOGLE_CLIENT_ID`**. If YouTube uses another OAuth client, set `GOOGLE_LOGIN_CLIENT_SECRET` for login. |
| **YouTube Connect: invalid_client** | Same Web client as login: app sends `VITE_GOOGLE_CLIENT_ID`; Supabase needs `GOOGLE_CLIENT_SECRET` (or `GOOGLE_LOGIN_CLIENT_SECRET`). In Google Cloud, add redirect URI `https://musicpromoai.site/auth/youtube/callback` (shows your domain on the Google account picker). Legacy direct callback `https://<project-ref>.supabase.co/functions/v1/youtube-oauth-callback` is optional. |
| **Client ID mismatch** (old deploys) | Redeploy `googleAuthExchange`; app client ID is used for exchange — only the **secret** must match in Supabase. |
| `redirect_uri_mismatch` | Redirect URI in Google must **exactly** match `https://musicpromoai.site/auth/google/callback` |
| `Sign in with Google is not enabled` | Enable Google provider in Supabase with matching Client ID |
| Edge function 401 | Deploy `googleAuthExchange` / `registerGoogleOAuthPkce`; `verify_jwt = false` in `supabase/config.toml` |
| Still shows supabase.co | Old flow: clear cache; ensure code uses `startGoogleSignIn`, not `signInWithOAuth` |
| Expo Google fails on local Supabase URL | Point `EXPO_PUBLIC_SUPABASE_*` at **hosted** project; run `npm run mobile:oauth-doctor` |
| `mobile/.env` missing Google ID | Set `VITE_GOOGLE_CLIENT_ID` in root `.env.local`, then `npm run mobile:sync-env` |
