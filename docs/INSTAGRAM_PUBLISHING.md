# Instagram Publishing — MusicPromo AI

**Phase:** 2F  
**Login type:** Instagram API with Instagram Login (Business Login for Instagram)  
**Status:** Implementation complete for drafts + server-side publish path. **Real Instagram publish is NOT claimed verified in this document until Test D succeeds.**

---

## 1. Architecture

```text
Campaign / Release
  → CampaignDay (planning source of truth)
  → SocialPost (publishing attempt)
  → socialPublish (Base44 function)
  → Instagram Content Publishing API (graph.instagram.com)
  → Published Instagram media
```

Related entities (unchanged roles):

| Entity | Role |
|--------|------|
| `CampaignDay` | Plan copy, hashtags, CTA, optional `video_project_id` |
| `GeneratedContent` | Optional caption source (referenced by ID) |
| `VideoProject` | Video composition; **mock renderer today** |
| `SocialAccount` | Connected IG account + encrypted token |
| `SocialPost` | Draft / publish lifecycle |

---

## 2. Required Meta permissions (Instagram Login)

Official Content Publishing guide (Instagram API with Instagram Login):

| Permission | Purpose |
|------------|---------|
| `instagram_business_basic` | Account identity / basic access |
| `instagram_business_content_publish` | Create containers + publish |

**Do not** request analytics / Facebook Page permissions in this phase.

OAuth authorize URL remains:

`https://www.instagram.com/oauth/authorize`

Token exchange / Graph:

`https://api.instagram.com` · `https://graph.instagram.com`

---

## 3. OAuth changes

`INSTAGRAM_CONNECT_SCOPES` in `base44/shared/instagramOAuth.ts` now includes both:

- `instagram_business_basic`
- `instagram_business_content_publish`

**Reconnect required** for accounts connected before publishing scopes were added. Existing `SocialAccount` rows are **not** deleted. Social Hub shows **Reconnect** when `needsPublishReauth` is true (`scopes` missing `instagram_business_content_publish`).

Reconnect passes `force_reauth=true` so Instagram re-prompts. `socialOAuthCallback` stores permissions Meta actually returned on token exchange (not only the requested list). Enable `instagram_business_content_publish` in Meta **Business login settings** or Meta will never grant it.

---

## 4. Publish API flow (server-side)

Function: `socialPublish`

1. Authenticate Base44 user.  
2. Load `SocialPost`; verify `user_id`.  
3. Load `SocialAccount`; verify ownership + `status=connected` + publish scope.  
4. Decrypt credentials with `SOCIAL_TOKEN_ENCRYPTION_KEY`.  
5. Validate media (public HTTPS JPEG for images; real MP4 for video — see §6).  
6. Refuse if status is `published` / `publishing` or `external_post_id` set.  
7. Set status → `publishing`.  
8. `POST /{ig-user-id}/media` (`image_url` or `video_url` + `caption`).  
9. Poll `GET /{container-id}?fields=status_code` until `FINISHED`.  
10. `POST /{ig-user-id}/media_publish` with `creation_id`.  
11. Optionally fetch `permalink`.  
12. Persist `external_post_id`, `external_permalink`, `published_at`, status `published`.

On failure: status `failed`, sanitized `error_code` / `error_message`. Tokens never returned or logged.

---

## 5. Supported media (Phase 2F)

| Type | Supported now? | Notes |
|------|----------------|-------|
| **IMAGE** | **Yes, if** public HTTPS **JPEG** URL | Meta: JPEG only for images |
| **VIDEO / REELS** | **Blocked** until real render | VideoService is mock/preview-only; no MP4 |

Artwork uploaded via `UploadPublicFile` is the intended image source (release/song artwork).

PNG/WebP artwork will be **rejected** by media validation (Instagram JPEG requirement).

---

## 6. Media URL requirements

Meta cURLs media at publish time → URL must be **publicly reachable HTTPS**.

| Asset | Storage today | Publishable? |
|-------|---------------|--------------|
| Artwork | `UploadPublicFile` → permanent public URL | Yes if JPEG |
| Audio | `UploadPrivateFile` + signed URL | No (not a feed image/video post asset) |
| VideoProject `render_output_url` | Mock / usually empty | No until real renderer + public MP4 |

**If publishing is blocked:** it is due to **media hosting/rendering**, not OAuth — when the only available asset is preview-only video or non-JPEG artwork.

---

## 7. Base44 storage requirements (Phase 2G)

1. Real video renderer producing public HTTPS MP4 (or a safe temporary signed URL Meta can fetch for the full processing window).  
2. Optional JPEG normalization for artwork (PNG/WebP → JPEG).  
3. Do **not** permanently expose private audio or put Meta tokens in the browser.

---

## 8. SocialPost lifecycle

```text
draft → publishing → published
  ↓
failed  → (edit / retry) → draft → publishing → …
```

Statuses used: `draft` | `publishing` | `published` | `failed`  
Scheduling status is **not** used in 2F.

Mutations go through backend functions only (entity RLS: client create/update/delete **false**).

---

## 9. Error handling

Normalized codes: `INVALID_TOKEN`, `PERMISSION_DENIED`, `INVALID_MEDIA`, `MEDIA_NOT_READY`, `RATE_LIMITED`, `DUPLICATE`, `PROVIDER_ERROR`, `NOT_CONFIGURED`, `VALIDATION`.

Frontend shows human-readable messages only.

---

## 10. Retry behavior

Retry allowed when `status=failed`. Same `SocialPost` row is reused.  
If Meta accepted a post but our write failed after publish, retry could duplicate — rare; refuse when `external_post_id` is already set.

---

## 11. Security model

- Tokens only in `SocialAccount.encrypted_credentials` (FLS blocked for clients).  
- Decrypt + Meta calls only in Deno functions.  
- No `VITE_*` Meta secrets.  
- No tokens in localStorage / sessionStorage / URLs.  
- Ownership checks on `SocialPost` and `SocialAccount`.  
- Duplicate publish protection server-side.

---

## 12. Manual testing

### Test A — Existing OAuth

1. Open published app → Social Hub.  
2. Confirm Instagram Connected + username.  
3. If “Reconnect for publishing” appears, reconnect and re-approve scopes.

### Test B — Create Draft

1. Campaign Plan / Content / Calendar → **Post to Social**.  
2. Prefill caption/media.  
3. Save Draft → refresh → draft remains.

### Test C — Media Validation

1. Select preview-only video path → publish blocked with clear message.  
2. Non-JPEG artwork → blocked with JPEG message.

### Test D — Real Publish

Only with public JPEG artwork + publish scope:

1. Confirm account, caption, media.  
2. Publish → confirm dialog → wait.  
3. Status Published + external ID / permalink.  
4. Verify on Instagram.

### Test E — Duplicate Protection

Publish again → rejected (`DUPLICATE`).

### Test F — Failed Publish

Invalid media → `failed` + safe error.

---

## 13. Known Meta limitations

- JPEG-only images; public URL required.  
- ~100 API publishes / 24h per IG account.  
- Professional IG account required.  
- Advanced Access / App Review for third-party users.  
- Page Publishing Authorization may affect some Page-linked accounts.  
- No first-class Instagram schedule API — scheduling is app-side (later phase).

---

## 14. Remaining for scheduling (Phase 2G+)

- Real MP4 rendering + public hosting.  
- JPEG conversion pipeline.  
- `scheduled` status + worker / cron.  
- TikTok / YouTube / Facebook.  
- Analytics import.

---

## Deploy checklist (2F)

```bash
base44 entities push          # includes SocialPost
base44 functions deploy socialPostCreate socialPostUpdate socialPostList socialPublish socialOAuthStart socialOAuthCallback socialConnectionStatus
# or: base44 functions deploy
```

Enable `instagram_business_content_publish` in Meta App Dashboard and reconnect Instagram in the app.

---

*Keep this file free of real credential values.*
