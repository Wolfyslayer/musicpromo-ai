# Storage cleanup (`music-promo-assets`)

User uploads (audio, artwork, rendered MP4s) live in the Supabase Storage bucket **`music-promo-assets`**, usually at paths like:

`{user_id}/audio/...` · `{user_id}/artwork/...` · `{user_id}/assets/...`

References are stored as URLs inside **`campaign_days.data`**, **`prepared_media.data`**, and **`prepared_media.public_url`**.

## Automatic cleanup (recommended)

When you **delete a campaign** in the app, the client calls Edge Function **`purgeCampaignStorage`** before removing database rows. It deletes bucket files that belonged to that campaign **only if no other row** (another campaign, song, release, avatar, etc.) still references the same path.

Deploy: include `purgeCampaignStorage` in your Supabase deploy workflow.

### Orphan sweep (signed-in user)

```json
POST /functions/v1/purgeCampaignStorage
{ "orphanOnly": true }
```

Removes files under your user folder that are not referenced anywhere in the database.

## SQL (inspect before delete)

Run migration **`supabase/migrations/20261013_promo_storage_cleanup.sql`** once in the SQL editor.

**List orphans for a user** (replace UUID):

```sql
select * from public.list_orphan_promo_storage('YOUR_USER_UUID'::uuid);
```

**Delete orphans manually** (service role / SQL editor as postgres — review the select first):

```sql
delete from storage.objects o
using public.list_orphan_promo_storage('YOUR_USER_UUID'::uuid) x
where o.bucket_id = 'music-promo-assets'
  and o.name = x.object_name;
```

Shared artwork/audio on a **song** used by multiple campaigns is **not** deleted while any campaign or song row still references that URL.

## Free tier tips

| Approach | Notes |
| --- | --- |
| **This cleanup** | Best first step — removes dead renders and old campaign media. |
| **Smaller uploads** | Shorter promo videos and compressed JPEG artwork use less space. |
| **External CDN** | You could store large MP4s on Cloudflare R2 / S3 and keep only URLs in Postgres (requires code changes; not default today). |
| **Upgrade Supabase** | Pro plan increases storage quota if you still outgrow cleanup. |

Database rows alone do not count toward Storage quota; **bucket objects** do. Check **Supabase → Storage → music-promo-assets** for size.
