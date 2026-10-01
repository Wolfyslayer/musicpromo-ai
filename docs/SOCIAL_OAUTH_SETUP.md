# Social OAuth Setup — MusicPromo AI

**Phase:** 2E Step 3 (first real Meta OAuth test preparation)  
**Scope:** Instagram account connection only (no publishing, scheduling, or analytics)

This document prepares operators for the **first real** Instagram/Meta OAuth test. It does **not** claim that OAuth has succeeded until you complete the manual tests below.

---

## Real OAuth verification status

| Item | Status |
|------|--------|
| Static security audit (Phase 2E Step 2.5) | **PASS** |
| `npm run build` | **PASS** (re-run after any change) |
| Real Meta OAuth end-to-end | **PENDING** |
| Base44 production FLS/RLS for `encrypted_credentials` | **PENDING** runtime verification |
| Connect flow (Test A) | **PENDING** |
| Disconnect flow (Test C) | **PENDING** |
| Reconnect / duplicate handling (Test D) | **PENDING** |
| Browser credential leak check (Test B) | **PENDING** |

---

## Required configuration (summary)

### Server-only secrets (never `VITE_*`, never frontend source, never git)

| Secret | Role |
|--------|------|
| `META_CLIENT_ID` | Instagram app ID (used only in backend OAuth start/callback) |
| `META_CLIENT_SECRET` | Instagram app secret — **highly sensitive** |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | 32-byte AES-GCM key (base64) for stored tokens |

These must be set only via **Base44 secrets** (or the Builder secrets UI). Do not paste them into source files or ask contributors to commit them.

### Server configuration (still Base44 secrets — not browser-exposed)

| Secret | Role |
|--------|------|
| `META_REDIRECT_URI` | Exact HTTPS URL Meta redirects to after authorization |
| `PUBLIC_APP_URL` | Frontend origin for post-OAuth redirect to `/social` |

`META_CLIENT_ID` is also server-only (listed above); it is not a Vite public env var.

### Public frontend configuration (this app)

Normal Base44 app identity only, injected by `base44 link` / `base44 dev` / `base44 build`:

- `VITE_BASE44_APP_ID`
- Optional: `VITE_BASE44_APP_BASE_URL`, `VITE_BASE44_FUNCTIONS_VERSION`

**Do not** add `VITE_META_*`, client secrets, encryption keys, or tokens.

---

## Meta OAuth redirect URI (`META_REDIRECT_URI`)

### What the code expects

Implementation uses the secret `META_REDIRECT_URI` when building the Instagram authorize URL and when exchanging the authorization code (`socialOAuthStart`, `socialOAuthCallback`). Meta’s console **Valid OAuth Redirect URIs** must match this value **exactly** (scheme, host, path, no trailing slash unless you configure one everywhere).

Per [Base44 backend functions HTTP endpoints](https://docs.base44.com/developers/backend/resources/backend-functions/overview), each deployed function is reachable at:

```text
https://<your-published-app-origin>/functions/<function-name>
```

For Instagram OAuth, the callback function name is **`socialOAuthCallback`**, so the redirect path is always:

```text
/functions/v1/meta-oauth-callback
```

**Full redirect URIs:**

```text
https://hmqxptxtcejhmuwbegvq.supabase.co/functions/v1/meta-oauth-callback
https://hmqxptxtcejhmuwbegvq.supabase.co/functions/v1/tiktok-oauth-callback
https://hmqxptxtcejhmuwbegvq.supabase.co/functions/v1/youtube-oauth-callback
```

### What cannot be determined from the repo alone

The hostname `<YOUR_PUBLISHED_APP_ORIGIN>` is assigned when your app is published on Base44 (e.g. a `*.base44.app` URL or a custom domain). It is **not** hard-coded in this repository.

**Manual steps to obtain the exact URL:**

1. Ensure the project is linked (`base44 link` — writes `base44/.app.jsonc` with your app id).
2. Deploy `socialOAuthCallback` (see [Base44 deployment](#base44-deployment) below).
3. Discover your published app origin using one of:
   - Run `base44 site open` and copy the origin from the browser address bar (scheme + host + port if any).
   - Open the Builder for your app (app id appears in `base44/.app.jsonc` after link, e.g. Builder URL pattern `app.db.com/apps/<app-id>/...`).
4. Set  
   `META_REDIRECT_URI=https://<origin>/functions/socialOAuthCallback`  
   via `base44 secrets set META_REDIRECT_URI=...`
5. Register the **same string** in Meta → Instagram → Business Login → Valid OAuth Redirect URIs.

**Verification (after deploy):** `base44 functions list` must include `socialOAuthCallback`. A GET to the redirect URI without valid OAuth params should return a safe error redirect or `social_error=invalid_response`, not expose secrets.

**Linked app id (local clone):** read `base44/.app.jsonc` → field `id`. This identifies the Base44 app; it is **not** the OAuth redirect hostname.

---

## `PUBLIC_APP_URL`

After a successful or failed OAuth callback, the browser is redirected to:

```text
{PUBLIC_APP_URL}/social?social_connected=instagram
```

or

```text
{PUBLIC_APP_URL}/social?social_error=<code>
```

Codes are safe enums only (`cancelled`, `invalid_state`, `provider_error`, etc.) — never tokens, codes, or ciphertext.

Set `PUBLIC_APP_URL` to the origin where users open MusicPromo AI (typically the same published site origin as step 3 above). Trailing slashes are stripped by the callback function.

If `PUBLIC_APP_URL` is missing, the callback returns **503** plain text instead of redirecting.

---

## Generate `SOCIAL_TOKEN_ENCRYPTION_KEY`

Generate a **new** random 32-byte key for each environment. **Do not** reuse example values or commit generated keys.

**Node (cross-platform):**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**OpenSSL:**

```bash
openssl rand -base64 32
```

**PowerShell:**

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

Then set (replace with your generated value):

```bash
base44 secrets set SOCIAL_TOKEN_ENCRYPTION_KEY="<paste-generated-base64-here>"
```

The backend rejects keys that are not exactly 32 bytes after base64 decode.

---

## Set all secrets (placeholders only)

```bash
base44 secrets set META_CLIENT_ID="<instagram-app-id>"
base44 secrets set META_CLIENT_SECRET="<instagram-app-secret>"
base44 secrets set META_REDIRECT_URI="https://<YOUR_PUBLISHED_APP_ORIGIN>/functions/socialOAuthCallback"
base44 secrets set PUBLIC_APP_URL="https://<YOUR_FRONTEND_ORIGIN>"
base44 secrets set SOCIAL_TOKEN_ENCRYPTION_KEY="<generated-base64-32-bytes>"
base44 secrets list
```

---

## Base44 deployment

Commands below were verified from this repo’s **Base44 CLI** (`base44 --help`, `base44 entities --help`, `base44 functions --help`, `base44 deploy --help`, `base44 site deploy --help`) and [README.md](../README.md).

### Prerequisites

```bash
npm install
npm install -g base44@latest   # if not already installed
base44 login
base44 link                    # once per clone; creates base44/.app.jsonc
```

### Publish workflow (this repository)

[README.md](../README.md) states this repo syncs to Base44 through **git**, and production publish is normally done from the **dashboard**:

```bash
base44 dashboard open
```

Use the dashboard to publish after pushing git changes, so deployed state stays aligned with the repo.

The CLI can also deploy resources directly; `base44 deploy` ships your **local tree** and can diverge from git-synced state if used instead of the dashboard workflow. Prefer **git push + dashboard publish** when that is your team’s source of truth; use CLI deploy when you intentionally want to push local backend/entity changes without a git round-trip.

### Entity deployment order

Deploy entities **before** running real OAuth tests. Recommended order:

1. **`SocialOAuthState`** — CSRF / single-use state (no client access)
2. **`SocialAccount`** — connection metadata + encrypted credentials (FLS on ciphertext)
3. **Backend functions** — OAuth and status/disconnect
4. **Frontend** — build and publish site

`base44 entities push` pushes all entity definitions under `base44/entities/` (including both social entities). There is no separate per-entity CLI name in the help text; order above is the logical dependency order.

**Do not start real Meta OAuth testing until entities and all four social functions are deployed and secrets are set.**

### Commands

| Step | Command |
|------|---------|
| Push entities | `base44 entities push` (add `-y` to skip confirm) |
| Deploy all social functions | `base44 functions deploy socialOAuthStart socialOAuthCallback socialConnectionStatus socialDisconnect` |
| Deploy all functions | `base44 functions deploy` |
| Deploy entities + functions + site (full) | `base44 deploy -y --build` |
| Build frontend with app id | `base44 build` |
| Deploy built site | `base44 site deploy -y --build` |
| List deployed functions | `base44 functions list` |
| View function logs (after test) | `base44 logs` (see `base44 logs --help`) |

**Expected `base44 functions list` entries for OAuth:**

- `socialOAuthStart`
- `socialOAuthCallback`
- `socialConnectionStatus`
- `socialDisconnect`

At preparation time, a linked clone may still show only legacy AI functions until you deploy the social functions above.

---

## Meta developer app preparation

Based on [SOCIAL_OAUTH_ARCHITECTURE.md](./SOCIAL_OAUTH_ARCHITECTURE.md) and the current implementation:

1. Create or open a app at [Meta for Developers](https://developers.facebook.com/).
2. Add **Instagram API with Instagram Login** (Business Login for Instagram).
3. Configure **Valid OAuth Redirect URI** = your exact `META_REDIRECT_URI`.
4. Use the **Instagram app ID** and **Instagram app secret** as `META_CLIENT_ID` / `META_CLIENT_SECRET`.
5. **Scopes (Facebook Login):** `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement` (see `instagramOAuth.ts`).
6. **Reconnect / scope upgrades:** the app passes `auth_type=rerequest` so Meta re-prompts; Page-linked Instagram Business/Creator required.
7. **Test accounts:** Instagram **professional** account linked to a Facebook Page you admin. Personal IG accounts are not supported.
8. **Development mode:** users typically must be app **admins, developers, or testers** on the Meta app.
9. **Production / other users:** Advanced Access, **App Review**, and often **Business Verification** may be required. Approval is **not** guaranteed; plan accordingly.

Meta documentation and requirements change; treat Meta’s dashboard as authoritative.

---

## Frontend connect flow (expected)

**Disconnected:** Social Hub shows Instagram with **Connect** (only when `socialConnectionStatus` reports `providersConfigured.instagram === true`).

**Connect click:**

1. Frontend → authenticated `socialOAuthStart` (`src/services/socialService.js`).
2. Browser navigates to Meta/Instagram `authorizationUrl` (no secrets in response).
3. User approves scopes `instagram_business_basic` and `instagram_business_content_publish` (reconnect uses `force_reauth=true`).
4. Meta → GET `META_REDIRECT_URI` with `code` and `state` (handled server-side only).
5. `socialOAuthCallback` validates state, exchanges code, stores **granted** permissions from Meta, encrypts token, upserts `SocialAccount`.
6. Browser redirect → `{PUBLIC_APP_URL}/social?social_connected=instagram`.
7. Social Hub reloads status via `socialConnectionStatus` and shows **Connected** with username / name / profile image when available. Publishing requires granted `instagram_business_content_publish`.

No access token, authorization code, or `encrypted_credentials` should appear in the final URL or in browser storage.

---

## Error flow (expected)

Failed OAuth redirects to `{PUBLIC_APP_URL}/social?social_error=<code>` when `PUBLIC_APP_URL` is set.

Safe codes handled in `SocialHub.jsx`:

| Code | User-facing message |
|------|---------------------|
| `cancelled` | Authorization cancelled |
| `invalid_response` | Incomplete response |
| `invalid_state` | Invalid or expired request |
| `state_reused` | Link already used |
| `expired_state` | Request expired |
| `not_configured` | Server not configured |
| `provider_error` | Generic connection failure |

Unknown `social_error` values show a generic message (no raw Meta errors in the URL).

If `PUBLIC_APP_URL` is missing, the user may see a **503** plain-text configuration page from the callback instead of Social Hub — fix secrets, do not patch around with client-side secrets.

---

## Disconnect flow (expected)

**Connected** → **Disconnect** → `socialDisconnect` invoke (not direct entity writes from the browser).

Server filters by authenticated `user.id` and provider; clears `encrypted_credentials`; sets `status=disconnected`. No provider-side revoke in this phase.

---

## Duplicate Instagram connection (current behavior)

Documented from `socialOAuthCallback` (no redesign in Step 3):

- **One connected Instagram account per MusicPromo user:** before saving, other **connected** Instagram rows for that user are set to `disconnected` and credentials wiped.
- **Same Instagram account reconnecting:** upsert by `user_id` + `provider` + `provider_account_id` — prefers an existing **connected** row, else the most recently connected matching row; updates that row instead of creating duplicates when possible.
- **Different Instagram account on same user:** previous connected row is disconnected locally; new profile is stored on connect.

Verify during Test D that you do not accumulate multiple **connected** rows for one user.

---

## Manual test checklist

Run only after: secrets set, entities pushed, four social functions deployed, Meta redirect URI registered, eligible test account available.

### Test A — Connect

- [ ] Open MusicPromo AI (published or `base44 dev` with appropriate backend mode).
- [ ] Open **Social Hub** (`/social`).
- [ ] Click Instagram → **Connect**.
- [ ] Authenticate with an eligible Meta/Instagram test account.
- [ ] Approve requested access (`instagram_business_basic`).
- [ ] Return to MusicPromo AI.
- [ ] Confirm Instagram shows **Connected**.
- [ ] Confirm username / account name / profile image if returned by Meta.

### Test B — Browser inspection

After a successful connect:

- [ ] Final URL has no `access_token`, no `code`, no `state` (query should be empty or non-sensitive after Social Hub strips params).
- [ ] `localStorage` / `sessionStorage` contain no Instagram/Meta access token (Base44 auth tokens may exist separately).
- [ ] Network responses from `socialConnectionStatus` contain no client secret, encryption key, or `encrypted_credentials`.
- [ ] No Meta secret values in page source or JS bundle (`VITE_META_*` absent).

### Test C — Disconnect

- [ ] Click **Disconnect**.
- [ ] UI shows disconnected / Connect again.
- [ ] Optional: confirm in Builder/data that `encrypted_credentials` is empty for that row (server-side).

### Test D — Reconnect

- [ ] Connect again with the same Instagram account.
- [ ] Connection restores; no unnecessary duplicate **connected** rows for the same user.
- [ ] Optional: connect a different Instagram account and confirm prior connection is disconnected per policy above.

**Do not mark these checkboxes complete until executed.**

---

## Security model (summary)

| Item | Location |
|------|----------|
| Client secret | Base44 secrets only |
| Encryption key | Base44 secrets only |
| Access tokens | AES-GCM in `SocialAccount.encrypted_credentials` |
| Frontend ciphertext | Blocked by field rules + no client entity writes |
| `SocialOAuthState` | No client RLS access |
| Status API | Safe metadata only |

---

## TikTok / Google legal pages

After **site publish**, paste these into TikTok Developer Portal and Google OAuth consent:

| Purpose | URL |
|---------|-----|
| Privacy Policy | `https://flying-sonic-promo-flow.base44.app/privacy` |
| Terms of Service | `https://flying-sonic-promo-flow.base44.app/terms` |

Privacy and Terms are public React routes (no login).

---

## Campaign auto-publish + video + daily stats worker

`campaignWorker` runs publish, attaches client-rendered videos, and syncs
analytics (at most once per 24h via `AutomationCheckpoint`).

**Schedule (Workflows):** this app has Workflows enabled, so legacy
`function.jsonc` automations cannot be used. In the Base44 Dashboard →
**Workflows**, create a **Scheduled** workflow that invokes `campaignWorker`
every hour.

**Video render:** promo MP4s are encoded in the browser with Remotion
(WebCodecs). Campaign create / Video Studio upload the MP4, then call
`campaignAutoVideo` to link PreparedMedia + CampaignDay rows.

Schedule a day from the Campaign Plan UI (**Schedule auto-publish**) which calls
`campaignSchedule`.

Statuses: `scheduled` → `publishing` / day `processing` → `published` / day
`posted` (or `failed` with error logs).

---

## What is intentionally out of scope

- Background token refresh  
- Mock credentials or fake OAuth responses  

---

*Keep this file free of real credential values.*
