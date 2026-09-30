# Media Preparation — MusicPromo AI

**Phase:** 2F.5  
**Scope:** Automatic JPEG preparation for Instagram image publishing  
**Video preparation:** Not implemented

---

## Why this exists

Instagram Content Publishing (Instagram Login) accepts **JPEG** images fetched from a **public HTTPS** URL. Artists often upload **PNG** or **WebP** artwork via MusicPromo’s public upload path.

MediaPreparation converts supported artwork into a durable public JPEG **without** replacing the original file and **without** requiring conversion merely to save a draft.

---

## Architecture

```text
User artwork (JPEG / PNG / WebP)
  → Original public URL (unchanged)
  → MediaPreparation (prepareMedia / shared helper)
  → PreparedMedia (public HTTPS JPEG)
  → SocialPost.prepared_media_url (optional reference)
  → socialPublish → Instagram
```

Original `SocialPost.media_url` always remains the source artwork.

---

## Supported formats (this phase)

| Direction | Formats |
|-----------|---------|
| Source | JPEG, JPG, PNG, WebP |
| Output | JPEG (quality ~90), public HTTPS |
| Video | **Not implemented** (Reels / MP4 remain blocked) |

Transparency (PNG alpha) is composited onto **white** before JPEG encoding.

**Codec note:** Conversion uses pure-JS `jpeg-js` + `pngjs` (no native Node `.node` binaries) so Base44 Deno function bundling succeeds. WebP uses WebCodecs `ImageDecoder` when the runtime provides it; otherwise re-upload as PNG/JPEG.

---

## Purpose catalog

| Purpose | Status |
|---------|--------|
| `instagram_feed_image` | **Implemented** |
| `generic_social_image` | Implemented (same JPEG path) |
| `instagram_reel` | Reserved — not implemented |

---

## PreparedMedia entity

Server-written only (`create` / `update` / `delete` client RLS **false**). Clients may read own rows.

Key fields: `user_id`, `source_url`, `source_format`, `purpose`, `prepared_url`, `prepared_format`, `width`, `height`, `file_size`, `status` (`pending` \| `ready` \| `failed`), sanitized errors.

No OAuth tokens or credentials are stored here.

---

## Backend function

`prepareMedia`

1. Authenticate user  
2. Accept `sourceUrl` + `purpose`  
3. Deduplicate by `user_id` + `source_url` + `purpose` + `status=ready`  
4. Download source (HTTPS)  
5. Detect format via magic bytes  
6. Convert to JPEG (ImageScript — Deno-compatible, no native binary)  
7. Upload via Base44 `UploadPublicFile` / `UploadFile`  
8. Persist `PreparedMedia`  
9. Return safe metadata  

`socialPublish` calls the shared `prepareInstagramFeedImage` helper before creating the Instagram media container for **IMAGE** posts.

---

## Deduplication

If a ready `PreparedMedia` already exists for the same user, source URL, and purpose, that `prepared_url` is reused (no new upload).

---

## Save Draft vs Publish

| Action | JPEG required? | Conversion? |
|--------|----------------|-------------|
| Save Draft | **No** | No |
| Publish (IMAGE) | Output must be JPEG | Auto if source is PNG/WebP/JPEG normalize |

---

## Error codes

| Code | Meaning |
|------|---------|
| `MEDIA_SOURCE_MISSING` | No source URL |
| `MEDIA_FETCH_FAILED` | Download failed |
| `MEDIA_NOT_AN_IMAGE` | Bytes are not a supported image |
| `MEDIA_FORMAT_UNSUPPORTED` | Format cannot be prepared |
| `MEDIA_CONVERSION_FAILED` | Encode/convert failed |
| `MEDIA_UPLOAD_FAILED` | Public upload failed |
| `MEDIA_PUBLIC_URL_REQUIRED` | Source not public HTTPS |
| `MEDIA_PREPARATION_FAILED` | Generic failure |
| `MEDIA_PURPOSE_UNSUPPORTED` | e.g. reel/video not implemented |

---

## Security

- Preparation and upload run server-side only  
- No tokens in `PreparedMedia` or responses  
- No secrets in logs (purpose, formats, codes only)  
- Existing SocialAccount encryption / FLS unchanged  

---

## Future (not in 2F.5)

- Video / Reels MP4 preparation  
- TikTok / YouTube / Facebook requirements  
- FFmpeg rendering  
- Scheduling  

---

## Deploy

```bash
base44 entities push
base44 functions deploy prepareMedia socialPublish
# or redeploy all functions after shared/ changes:
base44 functions deploy
```

---

*Instagram image preparation is implemented. Video preparation/rendering is not implemented yet.*
