import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { secrets } from "base44:runtime";
import {
  hasInstagramPublishScope,
  META_OAUTH_REDIRECT_URI,
} from "../../shared/instagramOAuth.ts";
import {
  TIKTOK_OAUTH_REDIRECT_URI,
  fetchTikTokProfile,
} from "../../shared/tiktokOAuth.ts";
import { YOUTUBE_OAUTH_REDIRECT_URI } from "../../shared/youtubeOAuth.ts";
import { hasFacebookPublishScope } from "../../shared/facebookOAuth.ts";
import { hasXPublishScope } from "../../shared/xOAuth.ts";
import { decryptCredential } from "../../shared/socialCrypto.ts";

/** True when a Base44 secret exists and is non-empty after trim. */
function hasSecret(...names: string[]): boolean {
  for (const name of names) {
    try {
      const value = secrets.get(name);
      if (typeof value === "string" && value.trim().length > 0) return true;
      if (value != null && typeof value !== "string" && Boolean(value)) return true;
    } catch {
      /* ignore missing / unreadable secret */
    }
  }
  return false;
}

/**
 * Backfill TikTok avatar / display name when missing on an existing connection.
 * Older connects requested unauthorized fields and saved empty profile metadata.
 */
async function enrichTikTokProfileIfNeeded(
  // deno-lint-ignore no-explicit-any
  base44: any,
  row: Record<string, unknown>,
  encryptionKey: string
): Promise<Record<string, unknown>> {
  const hasAvatar = Boolean(String(row.profile_image_url || "").trim());
  const hasName =
    Boolean(String(row.username || "").trim()) ||
    (Boolean(String(row.account_name || "").trim()) &&
      String(row.account_name) !== "TikTok");
  if (hasAvatar && hasName) return row;
  if (!encryptionKey || !row.encrypted_credentials) return row;

  try {
    const plain = await decryptCredential(String(row.encrypted_credentials), encryptionKey);
    const creds = JSON.parse(plain) as { access_token?: string };
    if (!creds?.access_token) return row;

    const profile = await fetchTikTokProfile(creds.access_token);
    const patch: Record<string, unknown> = {};
    if (!hasAvatar && profile.avatar_url) patch.profile_image_url = profile.avatar_url;
    if (profile.display_name && (!hasName || String(row.account_name) === "TikTok")) {
      patch.account_name = profile.display_name;
    }
    if (profile.username && !String(row.username || "").trim()) {
      patch.username = profile.username;
    } else if (
      !String(row.username || "").trim() &&
      profile.display_name &&
      String(row.account_name || "") === "TikTok"
    ) {
      patch.username = profile.display_name;
    }

    if (!Object.keys(patch).length) return row;
    await base44.asServiceRole.entities.SocialAccount.update(row.id, patch);
    console.log("[socialConnectionStatus] enriched tiktok profile", Object.keys(patch));
    return { ...row, ...patch };
  } catch (err) {
    console.warn(
      "[socialConnectionStatus] tiktok enrich",
      (err as Error)?.message || err
    );
    return row;
  }
}

/**
 * Safe connection metadata for the Social Hub.
 * Never returns tokens, secrets, or encrypted_credentials.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await base44.asServiceRole.entities.SocialAccount.filter(
      { user_id: user.id },
      "-connected_at",
      50
    );

    const encryptionKey = secrets.get("SOCIAL_TOKEN_ENCRYPTION_KEY") || "";
    const enriched = [];
    for (const row of rows || []) {
      if (row.status !== "connected") continue;
      if (row.provider === "tiktok") {
        enriched.push(await enrichTikTokProfileIfNeeded(base44, row, encryptionKey));
      } else {
        enriched.push(row);
      }
    }

    const connections = enriched.map((r) => {
      let canPublish = false;
      if (r.provider === "instagram") {
        canPublish = hasInstagramPublishScope(r.scopes);
      } else if (r.provider === "tiktok") {
        const scopes = String(r.scopes || "");
        canPublish = /video\.publish|video\.upload/.test(scopes);
      } else if (r.provider === "youtube") {
        const scopes = String(r.scopes || "");
        canPublish = /youtube\.upload|youtube\b/.test(scopes);
      } else if (r.provider === "facebook") {
        canPublish = hasFacebookPublishScope(r.scopes);
      } else if (r.provider === "x") {
        canPublish = hasXPublishScope(r.scopes);
      }
      return {
        id: r.id,
        provider: r.provider,
        status: r.status,
        accountName: r.account_name || null,
        username: r.username || null,
        profileImageUrl: r.profile_image_url || null,
        connectedAt: r.connected_at || null,
        scopes: r.scopes || null,
        expiresAt: r.expires_at || null,
        canPublish,
        needsPublishReauth:
          (r.provider === "instagram" ||
            r.provider === "tiktok" ||
            r.provider === "youtube" ||
            r.provider === "facebook" ||
            r.provider === "x") &&
          !canPublish,
      };
    });

    const sharedReady =
      hasSecret("SOCIAL_TOKEN_ENCRYPTION_KEY") &&
      hasSecret("PUBLIC_APP_URL", "APP_PUBLIC_URL");

    return Response.json({
      connections,
      providersConfigured: {
        instagram: Boolean(
          sharedReady && hasSecret("META_CLIENT_ID") && hasSecret("META_CLIENT_SECRET")
        ),
        tiktok: Boolean(
          sharedReady &&
            hasSecret("TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_ID") &&
            hasSecret("TIKTOK_CLIENT_SECRET")
        ),
        youtube: Boolean(
          sharedReady &&
            hasSecret("GOOGLE_CLIENT_ID", "YOUTUBE_CLIENT_ID") &&
            hasSecret("GOOGLE_CLIENT_SECRET", "YOUTUBE_CLIENT_SECRET")
        ),
        facebook: Boolean(
          sharedReady && hasSecret("FACEBOOK_CLIENT_ID") && hasSecret("FACEBOOK_CLIENT_SECRET")
        ),
        x: Boolean(
          sharedReady &&
            hasSecret("X_CLIENT_ID", "TWITTER_CLIENT_ID", "X_API_KEY") &&
            hasSecret("X_CLIENT_SECRET", "TWITTER_CLIENT_SECRET", "X_API_SECRET")
        ),
      },
      metaOAuthRedirectUri: META_OAUTH_REDIRECT_URI,
      tiktokOAuthRedirectUri: TIKTOK_OAUTH_REDIRECT_URI,
      youtubeOAuthRedirectUri: YOUTUBE_OAUTH_REDIRECT_URI,
    });
  } catch (error) {
    console.error("[socialConnectionStatus]", error?.message || "status failed");
    return Response.json({ error: "Could not load connection status." }, { status: 500 });
  }
}
