# MusicPromo AI — Social OAuth Architecture

**Phase:** 2E Step 1 (Research + Architecture + Documentation)  
**Status:** Documentation only — **no OAuth implementation, no SocialAccount entity, no tokens stored**  
**Date:** 2026-09-29

This document designs how MusicPromo AI will eventually connect Instagram, TikTok, YouTube, and Facebook using official platform APIs, while fitting the existing React + Vite + Base44 architecture.

---

## 1. Current architecture

### Frontend

| Area | Location | Role today |
|------|----------|------------|
| Social Hub UI | `src/pages/SocialHub.jsx` | Shows platform cards, publishing empty state, recent posts empty state |
| Platform cards | `src/components/social/SocialPlatformCard.jsx` | Connect disabled / “Not configured” |
| Static config | `src/services/social/providers.js` | Instagram, TikTok, YouTube, Facebook metadata + capability flags (all `false`) |
| Provider stubs | `src/services/social/provider.js` | Stub methods throw “not available yet” |
| Service façade | `src/services/socialService.js` | `getProviders()`, `getProvider()`, `getConnectionStatus()` → always `unavailable` |
| Base44 client | `src/api/base44Client.js` | Frontend SDK; uses `VITE_BASE44_*` for app identity only |

### Backend (existing)

| Area | Location | Role today |
|------|----------|------------|
| Deno functions | `base44/functions/*/entry.ts` | AI helpers (`generateContent`, `generateCampaign`, `analyzeSong`, `analyzeCampaignPerformance`) |
| Auth pattern | `createClientFromRequest(req)` + `base44.auth.me()` | Authenticated user context from SDK invoke |
| Secrets | Base44 `secrets.get()` / `base44 secrets set` | **Available** for server-only credentials (not used for social yet) |
| HTTP endpoints | `https://<app>/functions/<name>` | Suitable for OAuth **callbacks / webhooks** (no user JWT on inbound redirect) |
| Entities | `base44/entities/*.jsonc` | Artist, Song, Release, Campaign, CampaignDay, GeneratedContent, VideoProject, AnalyticsEntry, User — **no SocialAccount** |

### What Phase 2D deliberately does **not** do

- No OAuth, tokens, client secrets, or provider API calls  
- No fake connected accounts or posts  
- No schema for social credentials  

### Design implication

OAuth **must** live in **Base44 backend functions**, not in the Vite bundle. The frontend Social Hub only starts flows and displays safe account metadata returned by the backend.

---

## 2. Official provider requirements

Primary sources (official docs; not tutorials):

| Platform | Official sources used |
|----------|----------------------|
| Instagram / Meta | [Instagram Platform overview](https://developers.facebook.com/docs/instagram-platform/overview), [Business Login for Instagram](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/), [Content Publishing](https://developers.facebook.com/docs/instagram-api/guides/content-publishing), [Refresh Access Token](https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token/) |
| Facebook / Meta | [Facebook Login / long-lived tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/), Meta App Review / permissions model |
| TikTok | [Login Kit (Web)](https://developers.tiktok.com/doc/login-kit-web), [User Access Token Management](https://developers.tiktok.com/doc/oauth-user-access-token-management), [Content Posting API](https://developers.tiktok.com/docs/en/content-posting-api-get-started) |
| YouTube / Google | [OAuth 2.0 for Web Server Apps (YouTube)](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps), [Videos: insert](https://developers.google.com/youtube/v3/docs/videos/insert), [YouTube Analytics API](https://developers.google.com/youtube/analytics/v1/) |
| Base44 | [Backend Functions overview](https://docs.base44.com/developers/backend/resources/backend-functions/overview), [secrets set](https://docs.base44.com/developers/references/cli/commands/secrets-set) |

---

### 2.1 Instagram / Meta

**Account types**

- API access is for **Instagram professional accounts** (Business or Creator).  
- **Personal Instagram accounts are not supported** for the Instagram Platform publishing/insights APIs described here.

**Two API configurations** (from Meta’s overview; they are **not** identical):

| | Instagram Login | Facebook Login |
|--|-----------------|----------------|
| Login credentials | Instagram | Facebook |
| Facebook Page required | **No** | **Yes** (Page linked to IG professional account) |
| API host | `graph.instagram.com` | `graph.facebook.com` |
| Token type | Instagram User access token | Facebook User / Page access token |
| Scopes (examples) | `instagram_business_basic`, `instagram_business_content_publish`, … | `instagram_basic`, `instagram_content_publish`, Page perms (`pages_show_list`, …) |

**Recommendation for MusicPromo AI (connection phase):** Prefer **Instagram API with Instagram Login** (Business Login for Instagram) so artists without a Facebook Page can still connect. Keep Facebook Login as an alternative if Page-linked flows / certain features (e.g. hashtag search) are needed later.

**OAuth / tokens (Instagram Login path)**

1. User authorizes via Meta embed / `https://www.instagram.com/oauth/authorize`  
2. Redirect returns **authorization code** (≈ 1 hour)  
3. Exchange code → **short-lived** Instagram User token (≈ 1 hour)  
4. Exchange short-lived → **long-lived** token (**60 days**)  
5. Refresh via `GET graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=…` when token is ≥ 24h old and not expired → another 60 days  

**Access levels**

- **Standard Access:** app roles / testing / accounts you manage  
- **Advanced Access:** other users’ accounts → **App Review + Business Verification**

**Publishing (separate from connection)**

- Container + publish flow: `POST /{ig-user-id}/media` then `POST /{ig-user-id}/media_publish`  
- Media must be on a **publicly reachable URL** (Meta cURLs it)  
- Image format: **JPEG** for images (documented limitation)  
- Rate limit: **100 API-published posts / 24h** per IG account (check `content_publishing_limit`)  
- Needs publish permission (`instagram_business_content_publish` or `instagram_content_publish` depending on login type)  
- Page Publishing Authorization (PPA) can block Page-linked accounts until completed  

**Analytics**

- Insights APIs exist under Instagram Platform; require insights-related permissions and Advanced Access for non-owned accounts.  
- **Not the same** as connect-only scopes.

**Uncertainty / change risk**

- Meta renamed Instagram Login scopes (`instagram_business_*`); old `business_*` scopes were deprecated (Jan 2025). Always re-check App Dashboard before implementation.  
- Tech Provider / Access Verification may be required for production third-party use.

---

### 2.2 Facebook / Meta

**Account / asset types**

- For MusicPromo publishing, target **Facebook Pages**, not personal profile posts (Pages are the supported creator surface for third-party apps).  
- User authenticates with **Facebook Login for Business**; app obtains a **User** token, then derives **Page** tokens via `GET /{user-id}/accounts` (or `/me/accounts`).

**Tokens**

- Default User/Page tokens are short-lived (hours).  
- Exchange User token → **long-lived User** token.  
- Long-lived **Page** tokens derived from long-lived User tokens typically show **no expiry** (`expires_at: 0`) but invalidate when: user revokes app, changes password, loses Page role, or data-access / inactivity policies apply.  
- Page token must include Page **tasks** such as `CREATE_CONTENT` for publishing.

**Permissions (conceptual; confirm in App Dashboard at implement time)**

| Capability | Example permissions | App Review / Advanced Access |
|------------|---------------------|------------------------------|
| List Pages | `pages_show_list` | Often available earlier for own assets |
| Read engagement | `pages_read_engagement` | Depends on access level |
| Publish posts | `pages_manage_posts` | Typically **App Review + Advanced Access** for third-party Pages |

**Publishing vs analytics**

- Publish: Graph API Page feed / photo / video endpoints with Page token + `pages_manage_posts`.  
- Analytics: Page Insights endpoints; separate permissions and often review.  

**Uncertainty**

Exact permission packaging and review screens change; treat the App Dashboard as source of truth at implementation time.

---

### 2.3 TikTok

**Login / connection (Login Kit — Web)**

Official flow requires **server-side** handling:

1. Backend creates CSRF `state`, stores it (cookie/session or short-lived server store)  
2. Redirect user to `https://www.tiktok.com/v2/auth/authorize/` with `client_key`, `scope`, `redirect_uri`, `state`, `response_type=code`  
3. Callback to registered **HTTPS** redirect URI (static URI; no query params in registered URI; max 10 URIs; length &lt; 512)  
4. Backend exchanges `code` for tokens via TikTok token endpoint  

**Tokens** (official User Access Token Management)

| Token | Lifetime (as documented) |
|-------|---------------------------|
| `access_token` | **24 hours** |
| `refresh_token` | **365 days** (may rotate on refresh — store the new value) |

Client secret and refresh tokens **must** stay on the server (explicitly required by TikTok Login Kit docs).

**Scopes (examples)**

| Scope | Purpose |
|-------|---------|
| `user.info.basic` | Account connection / basic profile |
| `video.upload` | Upload to inbox / editing flow |
| `video.publish` | **Direct** post to user’s profile |

**Publishing (Content Posting API) — separate product + approval**

- App must enable Content Posting API and get **scope approval**.  
- Direct post requires `video.publish` and Direct Post configuration.  
- Upload-to-inbox requires `video.upload`; user finishes in TikTok.  
- Media via `PULL_FROM_URL` or `FILE_UPLOAD` patterns per Content Posting docs.  
- Rate limits apply (docs note e.g. per-token request limits on init endpoints).

**Uncertainty**

- Exact audit / review timelines for `video.publish` vary.  
- Eligibility errors (`error` on callback) must be handled when user cannot use third-party auth.

---

### 2.4 YouTube / Google

**Google account vs YouTube channel**

- OAuth authenticates a **Google user**.  
- YouTube operations require that user to have (or create) a **YouTube channel**.  
- Channel ID/title come from YouTube Data API (`channels.list` with `mine=true`), not from Google profile alone.

**OAuth (web server)**

- Authorization code flow with **client secret on server**.  
- Use `access_type=offline` and `prompt=consent` when a refresh token is required.  
- Access tokens expire (~1 hour); refresh via `https://oauth2.googleapis.com/token`.  
- **Testing** OAuth consent: refresh tokens for unverified apps in Testing mode are short-lived (**~7 days** per Google’s testing policies — verify current Google Cloud docs at implement time). Production + verification needed for durable tokens and public users.

**Scopes (examples)**

| Scope | Capability |
|-------|------------|
| `https://www.googleapis.com/auth/youtube.readonly` | Read channel / metadata |
| `https://www.googleapis.com/auth/youtube.upload` | Upload videos |
| `https://www.googleapis.com/auth/youtube` / `youtube.force-ssl` | Broader manage access |
| YouTube Analytics scopes | Separate Analytics API reports |

**Publishing**

- `videos.insert` (resumable upload recommended for large files).  
- Quota units apply (Google Cloud Quotas panel). Upload is quota-expensive relative to reads.

**Analytics**

- YouTube Analytics API (`reports.query`) — **not real-time** (often 48–72h latency).  
- Distinct from Data API live stats (`videos.list`).

**Uncertainty**

- Sensitive/restricted scopes may require Google verification.  
- Exact refresh-token lifetime rules depend on app verification status.

---

## 3. Platform capability matrix

Values reflect **official docs as of research date**. Conditions matter more than Yes/No.

| Platform | OAuth / Login | Account info | Publish | Native schedule API | Analytics | Special requirements |
|----------|---------------|--------------|---------|---------------------|-----------|----------------------|
| **Instagram** | Yes — Business Login for Instagram **or** Facebook Login for Business | Professional (Business/Creator) only; personal unsupported | Yes — Content Publishing API with publish permission; public media URL; JPEG images; 100 posts/24h | **No first-class schedule API** in Content Publishing guide — scheduling is app-side (publish at time T) | Insights with insights permissions + access level | Advanced Access + Business Verification for third-party users; choose login type; PPA possible for Page-linked |
| **Facebook** | Yes — Facebook Login for Business | Pages via `/accounts`; need Page role | Yes — Page token + `pages_manage_posts` (typically App Review for Advanced Access) | App-side scheduling; Graph may support `scheduled_publish_time` for some Page posts (**confirm current Graph reference at implement time**) | Page Insights with insights perms | Page vs user token model; task `CREATE_CONTENT` |
| **TikTok** | Yes — Login Kit (Web), server-held secret | `open_id` + user.info scopes | Yes — Content Posting API; `video.publish` (direct) or `video.upload` (inbox) after product/scope approval | App-side queue; TikTok does not replace MusicPromo’s scheduler | Limited vs Meta/YouTube; use approved display/analytics products if any — **do not assume full analytics parity** | HTTPS redirect URIs; 24h access / 365d refresh; scope audit |
| **YouTube** | Yes — Google OAuth 2.0 web server | Channel via Data API `mine=true` | Yes — `videos.insert` + upload scope; quota limited | App-side; YouTube may accept `publishAt` for private/scheduled uploads (**confirm Videos resource at implement time**) | YouTube Analytics API (delayed data) + Data API for basic stats | Cloud project, consent screen, verification for production; testing token limits |

---

## 4. OAuth flow per provider

### Common MusicPromo pattern (all providers)

```text
User → Social Hub → Connect
  → Frontend calls Base44 function: socialOAuthStart({ provider })
  → Backend builds auth URL (secrets + PKCE/state)
  → Browser redirects to provider
  → Provider redirects to Base44 function URL: /functions/socialOAuthCallback?provider=…
  → Backend: validate state, exchange code, fetch profile
  → Backend: store credentials securely + upsert SocialAccount metadata
  → Redirect browser to /social/connect?social_connected=provider
  → Social Hub loads accounts via socialOAuthStatus (safe fields only)
```

### Instagram (Instagram Login preferred)

```text
socialOAuthStart(instagram)
  → Meta authorize (instagram_business_* scopes for connect; add content_publish later)
  → Callback → short-lived → long-lived (60d)
  → Store encrypted tokens + ig_user_id + username
  → status: connected
```

### Facebook Pages

```text
socialOAuthStart(facebook)
  → Facebook Login for Business
  → Long-lived user token
  → List Pages (/me/accounts)
  → User selects Page (UI step — may be Phase 2E Step 2+)
  → Store Page id + Page access token
  → status: connected (page)
```

### TikTok

```text
socialOAuthStart(tiktok)
  → Login Kit authorize (user.info.basic first)
  → Callback → access_token (24h) + refresh_token (365d)
  → Store open_id + tokens
  → Publishing scopes requested in a later step / re-consent when Content Posting is approved
```

### YouTube

```text
socialOAuthStart(youtube)
  → Google authorize (readonly first; upload when publishing ships)
  → access_token + refresh_token (offline)
  → channels.list mine=true
  → Store channel_id + title + tokens
```

### Flow differences summary

| Topic | Instagram | Facebook | TikTok | YouTube |
|-------|-----------|----------|--------|---------|
| Page selection step | Optional (Login type) | **Usually required** | N/A | Channel resolution |
| Refresh model | Refresh long-lived IG token | Page token often non-expiring; user token refreshable | Refresh every ~24h | Refresh ~hourly access |
| Redirect host | Meta → Base44 function | Meta → Base44 function | TikTok → Base44 function | Google → Base44 function |

---

## 5. Security model

### Rules (non-negotiable)

| Secret / credential | Allowed location | Forbidden |
|---------------------|------------------|-----------|
| Provider **client secrets** | Base44 secrets (`secrets.get`) | `VITE_*`, frontend code, git |
| Access / refresh tokens | Server-side only (see storage below) | `localStorage`, `sessionStorage`, persistent React state, entity fields readable by other users without encryption |
| Client IDs | Often public for OAuth; still prefer server-built auth URLs | Hardcoding secrets beside them |
| Redirect URIs | Registered in provider consoles → Base44 **function** HTTPS URLs | Arbitrary open redirects |

### Recommended MusicPromo handling

1. **Authorization URL** created only in backend functions.  
2. **CSRF `state`** (and PKCE `code_verifier` where supported) stored server-side with short TTL, keyed by MusicPromo user id + random nonce. Prefer a short-lived entity or encrypted blob — not browser-only cookies unless HttpOnly cookie support is verified for Base44 callbacks.  
3. **Token exchange** only on server.  
4. **Frontend** receives: `{ provider, account_name, username, status, scopes, expires_at?, connected_at }` — never raw tokens.  
5. **Disconnect** deletes/revokes server credentials and marks account disconnected.

### Token lifecycle jobs (future)

- Instagram: refresh before 60d expiry (token must be ≥24h old).  
- TikTok: refresh access tokens on a schedule (&lt;24h).  
- Google: refresh access tokens; handle `invalid_grant` → `needs_reauthorization`.  
- Facebook Page: periodic `debug_token` / probe call; mark error on failure.

Use Base44 **function automations** (scheduled) where available; document that critical refresh should not rely solely on best-effort `waitUntil`.

---

## 6. Proposed SocialAccount schema

**Do not create this entity in Phase 2E Step 1.** Design only.

### Public / safe fields (entity or DTO)

```text
id
user_id                 # MusicPromo / Base44 user owning the connection
provider                # instagram | tiktok | youtube | facebook
provider_account_id     # IG user id / Page id / open_id / channel id
account_name            # display name
username                # handle if available
profile_image_url
account_type            # professional | page | channel | user (provider-specific)
status                  # connected | needs_reauthorization | disconnected | connection_error
scopes                  # granted scopes (string or string[])
connected_at
updated_at
token_expires_at        # access token expiry if known (nullable)
refresh_expires_at      # if known (TikTok refresh, etc.)
metadata                # non-secret JSON (e.g. page tasks, channel customUrl)
```

### Credentials storage (critical)

**Do not store plaintext access/refresh tokens in a normal Base44 entity field** unless Base44 provides documented field-level encryption / secret store for entities (not verified in this codebase).

**Recommended approach for Step 2 implementation planning:**

| Option | Description | Fit |
|--------|-------------|-----|
| **A. Encrypted credential blob in entity** | Store `credentials_ciphertext` + `credentials_kid`; encrypt with key from `secrets.get("SOCIAL_TOKEN_ENCRYPTION_KEY")` using Web Crypto in the Deno function | Fits Base44 without new infra; app must manage key rotation |
| **B. External secret vault** | AWS KMS / GCP Secret Manager / similar | Strongest isolation; **out of scope** unless Base44 alone proves insufficient |
| **C. Provider tokens only in memory** | Impossible for refresh/publish | Reject |

**Phase 2E Step 1 recommendation:** Plan for **Option A** inside Base44 functions + secrets. Revisit Option B if compliance review requires it.

`credentials` conceptual contents (never returned to frontend):

```text
access_token
refresh_token?          # TikTok, Google; Meta models differ
token_type
obtained_at
raw_expires_in
page_access_token?      # Facebook
instagram_user_id?
```

---

## 7. Provider abstraction

Compatible with Phase 2D stubs:

```text
Social Hub
  → socialService (frontend façade)
    → Base44 functions.invoke('socialOAuthStart' | 'socialOAuthStatus' | …)
      → Provider Adapter (server: InstagramProvider, …)
        → Official API
```

### Common interface (proposed)

| Method | All providers? | Notes |
|--------|----------------|-------|
| `getAuthorizationUrl({ userId, state, scopes })` | Yes | Server-only |
| `handleCallback({ code, state })` | Yes | Server-only |
| `getAccount(connection)` | Yes | Safe profile fields |
| `refreshToken(connection)` | Mostly | Facebook Page tokens may no-op / probe |
| `disconnect(connection)` | Yes | Best-effort revoke + delete local creds |
| `publish(connection, payload)` | Capability-flagged | Not all scopes granted initially |
| `getPosts(connection)` | Capability-flagged | Optional later |
| `getAnalytics(connection, query)` | Capability-flagged | Provider-specific metrics |
| `listSelectableAssets(connection)` | Facebook (Pages), maybe YT channels | Provider-specific |

Do **not** force every provider to implement `publish` / `getAnalytics` until scopes and App Review allow it. Keep `capabilities` on `providers.js` in sync with reality.

---

## 8. Environment variable design

Set via `base44 secrets set` (server). **Never** prefix secrets with `VITE_`.

### Proposed secrets (no values in repo)

```text
# Meta (Instagram Login app id/secret may differ from main Meta app id — see Meta dashboard)
META_APP_ID
META_APP_SECRET
INSTAGRAM_APP_ID
INSTAGRAM_APP_SECRET
META_OAUTH_REDIRECT_URI          # https://hmqxptxtcejhmuwbegvq.supabase.co/functions/v1/meta-oauth-callback

# TikTok
TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET
TIKTOK_OAUTH_REDIRECT_URI         # https://hmqxptxtcejhmuwbegvq.supabase.co/functions/v1/tiktok-oauth-callback

# Google / YouTube
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI         # https://hmqxptxtcejhmuwbegvq.supabase.co/functions/v1/youtube-oauth-callback

# App crypto
SOCIAL_TOKEN_ENCRYPTION_KEY      # for encrypting stored tokens
SOCIAL_OAUTH_STATE_SECRET        # optional HMAC for state blobs
```

### Public / frontend-safe (optional)

```text
# Prefer not exposing even client IDs if auth URLs are always server-built.
# If needed for SDKs later:
# VITE_PUBLIC_APP_URL=https://...
```

Redirect URIs must match provider console entries **exactly** (especially TikTok HTTPS + static path rules).

---

## 9. Base44 compatibility findings

| Question | Finding |
|----------|---------|
| Can functions perform OAuth callbacks? | **Yes** — each function has an HTTP endpoint suitable for provider redirects; use `asServiceRole` carefully and bind callback to MusicPromo user via `state` |
| Can they store secrets for client IDs/secrets? | **Yes** — `secrets.get()` / `base44 secrets set` |
| Outbound HTTPS to providers? | **Yes** — existing pattern is Deno `fetch` (functions already call integrations; third-party `fetch` is supported per Base44 docs) |
| Secure cookies? | **Uncertain** — do not depend on browser cookies alone for CSRF; prefer server-stored state keyed in `state` parameter |
| Persist tokens securely? | **Partial** — entities can persist data; **encryption key via secrets** required; no verified vault product in-app |
| Max execution time | **5 minutes** — enough for OAuth exchange; **not** for large YouTube uploads in one shot without resumable design |
| External backend needed now? | **Not for OAuth connect**. May become desirable later for long uploads, multi-region webhooks, or compliance-grade KMS |

**Recommendation:** Implement OAuth entirely with Base44 Deno functions + secrets + (future) encrypted SocialAccount credentials. Do **not** add Express/Next solely for OAuth.

---

## 10. Future publishing architecture

Out of scope for Step 1 — target model:

```text
CampaignDay
  → promotional fields / GeneratedContent / VideoProject
    → SocialPost (future entity)
      → SocialAccount
        → Provider Adapter
          → Official API
```

**Scheduling** sits between SocialPost and Provider:

```text
SocialPost.status: draft | scheduled | publishing | published | failed
SocialPost.scheduled_for: datetime
Automation / queue worker: when now >= scheduled_for → provider.publish()
```

MusicPromo owns the schedule clock for Instagram/TikTok where platforms lack (or limit) native schedule APIs. Do **not** create SocialPost / ScheduleJob in this phase.

---

## 11. Known limitations & blockers

1. **Instagram personal accounts** cannot use the professional publishing/insights stack.  
2. **App Review / Business Verification** (Meta), **scope audits** (TikTok), **OAuth verification** (Google) block production multi-tenant use.  
3. **Media hosting**: Instagram (and often others) need **public HTTPS media URLs** at publish time — Base44 file URLs must be confirmed public or proxied.  
4. **No fake “Connected” UI** until real tokens exist.  
5. **Token encryption** must be designed before persisting credentials in entities.  
6. **Facebook Page picker** UX required after login when multiple Pages exist.  
7. **TikTok direct post** may lag behind Login Kit approval.  
8. **YouTube quota** can halt uploads; analytics are delayed.  
9. **Base44 callback auth**: inbound OAuth redirect has **no user session** — `state` must encode enough to map to `user_id` securely.  
10. Provider policies change; re-verify scopes/redirects at implementation.

---

## 12. Disconnect & re-authorization (design)

### Disconnect

```text
Social Hub → Disconnect
  → socialOAuthDisconnect({ provider, accountId })
  → Best-effort provider revoke endpoint (if documented)
  → Delete encrypted credentials
  → status = disconnected (or hard-delete SocialAccount row)
```

Revocation support varies; always delete local credentials even if remote revoke fails.

### Re-authentication triggers

| Signal | UI status |
|--------|-----------|
| Refresh fails / `invalid_grant` | `needs_reauthorization` |
| User revoked app in provider settings | `needs_reauthorization` or `disconnected` |
| Missing Page role / channel deleted | `connection_error` |
| Scope upgrade needed for publish | Prompt incremental consent |

UI states already partially anticipated in Phase 2D (`connected`, `connection_error`, `not_connected`, `unavailable`); add `needs_reauthorization` when implementing.

---

## 13. Recommended implementation order (Phase 2E Step 2+)

1. **Secrets + redirect URIs** in Base44 / provider consoles (dev apps).  
2. **OAuth state store + encryption helpers** in `base44/shared/`.  
3. **`socialOAuthStart` / `socialOAuthCallback` / `socialOAuthStatus` / `socialOAuthDisconnect`** functions.  
4. **YouTube or Instagram connect-first** (clear docs; high artist value) — **connect + profile only**, no publish.  
5. **TikTok Login Kit** (basic scopes only).  
6. **Facebook Page connect** + Page picker.  
7. Create **SocialAccount** entity (safe fields + encrypted credentials blob).  
8. Wire Social Hub Connect buttons to real start URL (still no fake success).  
9. Token refresh automation.  
10. **Later phases:** publish scopes, SocialPost, scheduling, analytics imports.

Suggested first production-ready connect target: **Instagram (Instagram Login)** *or* **YouTube**, depending on which developer app verification path is faster for the team — both have mature OAuth docs; Instagram has more account-type constraints, YouTube has quota/verification constraints.

---

## 14. Explicit non-goals of this document’s phase

- No OAuth code  
- No SocialAccount / SocialPost entities created  
- No provider SDKs added  
- No client secrets committed  
- No Social Hub behavior change required  

When Step 2 begins, implement against this document and re-check official docs for scope name / redirect URI changes.

---

## Phase 2E Step 2 implementation notes

See also `docs/SOCIAL_OAUTH_SETUP.md`.

Implemented:

- Base44 functions: `socialOAuthStart`, `socialOAuthCallback`, `socialConnectionStatus`, `socialDisconnect`
- Entities: `SocialAccount` (FLS denies frontend access to `encrypted_credentials`), `SocialOAuthState` (no frontend access)
- AES-GCM encryption via `base44/shared/socialCrypto.ts`
- Instagram Login connect-only scope: `instagram_business_basic`
- One Instagram connection per user

Not implemented: TikTok / YouTube / Facebook OAuth, publishing, scheduling, analytics.
