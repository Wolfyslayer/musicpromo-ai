import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { secrets } from "base44:runtime";
import {
  hasInstagramPublishScope,
  META_OAUTH_REDIRECT_URI,
} from "../../shared/instagramOAuth.ts";

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

    const connections = (rows || [])
      .filter((r) => r.status === "connected")
      .map((r) => {
        const canPublish =
          r.provider === "instagram" && hasInstagramPublishScope(r.scopes);
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
          needsPublishReauth: r.provider === "instagram" && !canPublish,
        };
      });

    const instagramConfigured = Boolean(
      secrets.get("META_CLIENT_ID") &&
        secrets.get("META_CLIENT_SECRET") &&
        META_OAUTH_REDIRECT_URI &&
        secrets.get("SOCIAL_TOKEN_ENCRYPTION_KEY") &&
        (secrets.get("PUBLIC_APP_URL") || secrets.get("APP_PUBLIC_URL"))
    );

    return Response.json({
      connections,
      providersConfigured: {
        instagram: instagramConfigured,
        tiktok: false,
        youtube: false,
        facebook: false,
      },
      metaOAuthRedirectUri: META_OAUTH_REDIRECT_URI,
    });
  } catch (error) {
    console.error("[socialConnectionStatus]", error?.message || "status failed");
    return Response.json({ error: "Could not load connection status." }, { status: 500 });
  }
}
