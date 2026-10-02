import { jsonWithCors, servePostApi } from "../_shared/cors.ts";
import { createClientFromRequest } from "../_shared/runtime.ts";
import { secrets } from "../_shared/runtime.ts";
import { findOAuthState } from "../_shared/socialOAuthState.ts";
import { completeYouTubeConnect } from "../_shared/youtubeConnectCore.ts";
import { youTubeAppRedirectUri } from "../_shared/youtubeOAuth.ts";

async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return jsonWithCors(req, { error: "Unauthorized. Sign in and try again." }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const code = body?.code ? String(body.code) : "";
    const state = body?.state ? String(body.state) : "";
    if (!code || !state) {
      return jsonWithCors(req, { error: "code and state are required." }, 400);
    }

    const encryptionKey = String(secrets.get("SOCIAL_TOKEN_ENCRYPTION_KEY") || "").trim();
    if (!encryptionKey) {
      return jsonWithCors(req, { error: "SOCIAL_TOKEN_ENCRYPTION_KEY is not configured." }, 503);
    }

    const record = await findOAuthState(base44, state);
    if (!record) {
      return jsonWithCors(req, { error: "Invalid or expired OAuth state." }, 400);
    }
    if (String(record.provider || "") !== "youtube") {
      return jsonWithCors(req, { error: "OAuth state provider mismatch." }, 400);
    }
    if (record.user_id != null && String(record.user_id) !== String(user.id)) {
      return jsonWithCors(req, { error: "OAuth state does not match signed-in user." }, 403);
    }
    if (record.used) {
      return jsonWithCors(req, { error: "OAuth state already used." }, 400);
    }
    if (record.expires_at && new Date(String(record.expires_at)).getTime() < Date.now()) {
      return jsonWithCors(req, { error: "OAuth state expired." }, 400);
    }

    const publicAppUrl = String(
      secrets.get("PUBLIC_APP_URL") || secrets.get("APP_PUBLIC_URL") || ""
    )
      .trim()
      .replace(/\/$/, "");
    const redirectUri =
      (record.oauth_redirect_uri != null ? String(record.oauth_redirect_uri).trim() : "") ||
      (publicAppUrl ? youTubeAppRedirectUri(publicAppUrl) : "");

    if (!redirectUri) {
      return jsonWithCors(req, { error: "PUBLIC_APP_URL is not configured." }, 503);
    }

    const oauthClientId =
      record.oauth_client_id != null ? String(record.oauth_client_id).trim() : "";

    await completeYouTubeConnect({
      base44,
      code,
      boundUserId: String(user.id),
      encryptionKey,
      redirectUri,
      oauthClientId: oauthClientId || null,
    });

    if (record.id) {
      await base44.asServiceRole.entities.SocialOAuthState.delete(String(record.id)).catch(() => {});
    }

    return jsonWithCors(req, { ok: true, provider: "youtube" });
  } catch (err) {
    console.error("[youtubeOAuthComplete]", (err as Error)?.message || err);
    return jsonWithCors(
      req,
      {
        error: "Could not complete YouTube connection.",
        details: String((err as Error)?.message || err).slice(0, 300),
      },
      502
    );
  }
}

servePostApi(handler);
