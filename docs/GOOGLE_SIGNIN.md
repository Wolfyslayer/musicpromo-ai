# Google sign-in (your domain, free Supabase plan)

Google shows **“Continue to musicpromoai.site”** instead of `*.supabase.co` by using your site as the OAuth redirect URI and exchanging the code in an Edge Function, then `signInWithIdToken` for the Supabase session.

## 1. Google Cloud Console

Use the **same OAuth client** as YouTube/social (or create a **Web application** client).

**Authorized JavaScript origins**

- `https://musicpromoai.site`
- `http://localhost:5173` (local dev)

**Authorized redirect URIs** (add both; keep existing YouTube callback if you use it)

- `https://musicpromoai.site/auth/google/callback`
- `http://localhost:5173/auth/google/callback`

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

## Troubleshooting

| Issue | Fix |
| --- | --- |
| **Edge Function returned a non-2xx** | Open the error text after the fix deploy — usually Google token exchange. See rows below. |
| **The OAuth client was not found** | `GOOGLE_CLIENT_SECRET` must belong to the **same** Web client as **`VITE_GOOGLE_CLIENT_ID`**. If YouTube uses another OAuth client, set `GOOGLE_LOGIN_CLIENT_SECRET` for login. |
| **Client ID mismatch** (old deploys) | Redeploy `googleAuthExchange`; app client ID is used for exchange — only the **secret** must match in Supabase. |
| `redirect_uri_mismatch` | Redirect URI in Google must **exactly** match `https://musicpromoai.site/auth/google/callback` |
| `Sign in with Google is not enabled` | Enable Google provider in Supabase with matching Client ID |
| Edge function 401 | Deploy `googleAuthExchange`; `verify_jwt = false` in `supabase/config.toml` |
| Still shows supabase.co | Old flow: clear cache; ensure code uses `startGoogleSignIn`, not `signInWithOAuth` |
