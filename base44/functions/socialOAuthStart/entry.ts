import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { secrets } from "base44:runtime";
import { generateOAuthState } from "../../shared/socialCrypto.ts";
import { buildInstagramAuthorizeUrl, INSTAGRAM_CONNECT_SCOPES } from "../../shared/instagramOAuth.ts";

const SUPPORTED = new Set(["instagram"]);
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Authenticated start of OAuth. Returns { authorizationUrl } for the browser to navigate.
 * Secrets never leave the server.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const provider = String(body?.provider || "").toLowerCase();
    // Default on: silent Instagram re-auth reuses old grants and skips content_publish.
    const forceReauth = body?.forceReauth !== false && body?.force_reauth !== false;
    if (!SUPPORTED.has(provider)) {
      return Response.json(
        { error: "This provider is not available for connection yet." },
        { status: 400 }
      );
    }

    const clientId = secrets.get("META_CLIENT_ID");
    const redirectUri = secrets.get("META_REDIRECT_URI");
    const encryptionKey = secrets.get("SOCIAL_TOKEN_ENCRYPTION_KEY");
    const clientSecret = secrets.get("META_CLIENT_SECRET");
    const publicAppUrl = secrets.get("PUBLIC_APP_URL") || secrets.get("APP_PUBLIC_URL");

    if (!clientId || !clientSecret || !redirectUri || !encryptionKey || !publicAppUrl) {
      return Response.json(
        {
          error:
            "Instagram connection is not configured. Add META_CLIENT_ID, META_CLIENT_SECRET, META_REDIRECT_URI, PUBLIC_APP_URL, and SOCIAL_TOKEN_ENCRYPTION_KEY via Base44 secrets.",
          code: "not_configured",
        },
        { status: 503 }
      );
    }

    const state = generateOAuthState();
    const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();

    await base44.asServiceRole.entities.SocialOAuthState.create({
      state,
      user_id: user.id,
      provider,
      expires_at: expiresAt,
      used: false,
    });

    const authorizationUrl = buildInstagramAuthorizeUrl({
      clientId,
      redirectUri,
      state,
      scopes: INSTAGRAM_CONNECT_SCOPES,
      // Reconnect / scope upgrades must re-prompt; silent reuse keeps old grants.
      forceReauth,
    });

    return Response.json({
      authorizationUrl,
      provider,
      scopes: INSTAGRAM_CONNECT_SCOPES,
      forceReauth,
    });
  } catch (error) {
    console.error("[socialOAuthStart]", error?.message || "unknown error");
    return Response.json({ error: "Could not start connection." }, { status: 500 });
  }
}
