# Instagram Publishing — MusicPromo AI

**Phase:** 2F (updated)  
**Login type:** Facebook Login for Business → Instagram Graph Content Publishing  
**API host:** `graph.facebook.com`  
**Status:** OAuth + image publish + Reels container pipeline implemented. Real Reels publish still requires a public HTTPS MP4 from VideoProject.

---

## Architecture

```text
Campaign / Release
  → CampaignDay
  → SocialPost
  → socialPublish
  → graph.facebook.com Content Publishing
  → Published Instagram media / Reel
```

| Entity | Role |
|--------|------|
| `CampaignDay` | Plan copy, optional `video_project_id` |
| `SocialAccount` | IG Business Account id + encrypted Page token |
| `SocialPost` | Draft / publish lifecycle |
| `VideoProject` | Must expose public HTTPS MP4 for Reels |
| `PreparedMedia` | JPEG preparation for IMAGE posts |

---

## Required Meta permissions (Facebook Login)

| Permission | Purpose |
|------------|---------|
| `instagram_basic` | IG professional account identity |
| `instagram_content_publish` | Create containers + publish (incl. Reels) |

Instagram Connect requests **only** those two scopes (no `pages_*` / Facebook profile bundle) and always sends `auth_type=rerequest` so Meta focuses the dialog on Instagram Professional account selection.

- Authorize: `https://www.facebook.com/v21.0/dialog/oauth`
- Token + Graph: `https://graph.facebook.com`
- Secrets: **Facebook App ID/Secret** as `META_CLIENT_ID` / `META_CLIENT_SECRET`
- Redirect (fixed): `https://hmqxptxtcejhmuwbegvq.supabase.co/functions/v1/meta-oauth-callback`  
  Register this exact URI in Meta → Valid OAuth Redirect URIs. TikTok uses `.../tiktok-oauth-callback` and YouTube uses `.../youtube-oauth-callback`.

On connect, callback:
1. Exchanges `code` → short-lived User token → long-lived User token  
2. `GET /me/accounts` → finds `instagram_business_account`  
3. Stores IG id on `SocialAccount.provider_account_id`  
4. Encrypts Page access token (+ User token metadata) in `encrypted_credentials`

---

## Reels publish flow (`instagramPublishing.ts`)

1. `POST /{ig-user-id}/media` with `media_type=REELS`, `video_url`, `caption`  
2. Poll `GET /{container-id}?fields=status_code` until `FINISHED`  
3. `POST /{ig-user-id}/media_publish` with `creation_id`  
4. Persist `external_post_id` / permalink on `SocialPost`

Images use the same container → publish pattern with `image_url` (JPEG via MediaPreparation).

---

## Operator checklist

1. Meta app has **Facebook Login** + Instagram Graph products.  
2. IG Professional account linked to a Facebook Page you admin.  
3. Base44 secrets updated to Facebook App ID/Secret (not Instagram Login credentials).  
4. Disconnect any old Instagram-Login connection and reconnect.  
5. Deploy: `base44 functions deploy socialOAuthStart socialOAuthCallback socialPublish socialConnectionStatus`

```bash
base44 functions deploy socialOAuthStart socialOAuthCallback socialPublish socialConnectionStatus
base44 site deploy -y --build
```
