import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { secrets } from "base44:runtime";
import { encryptCredential } from "../../shared/socialCrypto.ts";
import {
  INSTAGRAM_CONNECT_SCOPES,
  exchangeInstagramCode,
  exchangeLongLivedToken,
  fetchInstagramProfile,
  normalizeGrantedPermissions,
  probeInstagramPublishCapability,
} from "../../shared/instagramOAuth.ts";

/** Frontend origin for post-OAuth redirects — must be configured explicitly (never infer from Host). */
function requirePublicAppUrl(): string | null {
  const configured = secrets.get("PUBLIC_APP_URL") || secrets.get("APP_PUBLIC_URL");
  if (!configured || !String(configured).trim()) return null;
  return String(configured).replace(/\/$/, "");
}

function redirectToSocial(home: string, query: Record<string, string>): Response {
  const qs = new URLSearchParams(query).toString();
  return Response.redirect(`${home}/social?${qs}`, 302);
}

function configurationErrorResponse(): Response {
  return new Response(
    "OAuth callback misconfigured: set PUBLIC_APP_URL in Base44 secrets to your frontend origin (HTTPS in production).",
    { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}

function safeErrorRedirect(home: string | null, code: string): Response {
  if (!home) return configurationErrorResponse();
  return redirectToSocial(home, { social_error: code });
}

/**
 * Meta OAuth callback (HTTP GET). No user JWT — bind via single-use state.
 * Never puts tokens or codes into the redirect URL.
 */
export default async function (req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");

  const publicAppUrl = requirePublicAppUrl();

  if (error || errorReason === "user_denied") {
    return safeErrorRedirect(publicAppUrl, "cancelled");
  }
  if (!code || !state) {
    return safeErrorRedirect(publicAppUrl, "invalid_response");
  }

  const clientId = secrets.get("META_CLIENT_ID");
  const clientSecret = secrets.get("META_CLIENT_SECRET");
  const redirectUri = secrets.get("META_REDIRECT_URI");
  const encryptionKey = secrets.get("SOCIAL_TOKEN_ENCRYPTION_KEY");
  if (!clientId || !clientSecret || !redirectUri || !encryptionKey) {
    return safeErrorRedirect(publicAppUrl, "not_configured");
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (err) {
    console.error("[socialOAuthCallback] client_init", err?.message || err);
    return safeErrorRedirect(publicAppUrl, "client_init_failed");
  }

  let record;
  try {
    const states = await base44.asServiceRole.entities.SocialOAuthState.filter(
      { state },
      "-created_date",
      5
    );
    record = (states || [])[0];
  } catch (err) {
    console.error("[socialOAuthCallback] state_lookup", err?.message || err);
    return safeErrorRedirect(publicAppUrl, "state_lookup_failed");
  }

  if (!record) {
    return safeErrorRedirect(publicAppUrl, "invalid_state");
  }
  if (record.used) {
    return safeErrorRedirect(publicAppUrl, "state_reused");
  }
  if (record.provider !== "instagram") {
    return safeErrorRedirect(publicAppUrl, "invalid_state");
  }
  if (new Date(record.expires_at).getTime() < Date.now()) {
    await base44.asServiceRole.entities.SocialOAuthState.delete(record.id).catch(() => {});
    return safeErrorRedirect(publicAppUrl, "expired_state");
  }

  const boundUserId = record.user_id;
  const boundProvider = record.provider;
  // Consume state before code exchange so replay cannot reuse the same state token.
  try {
    await base44.asServiceRole.entities.SocialOAuthState.delete(record.id);
  } catch (err) {
    console.error("[socialOAuthCallback] state_consume", err?.message || err);
    return safeErrorRedirect(publicAppUrl, "state_consume_failed");
  }

  let shortLived;
  try {
    shortLived = await exchangeInstagramCode({
      clientId,
      clientSecret,
      redirectUri,
      code,
    });
  } catch (err) {
    const msg = String(err?.message || "");
    console.error("[socialOAuthCallback] token_exchange", msg);
    const lower = msg.toLowerCase();
    if (lower.includes("redirect") || lower.includes("uri")) {
      return safeErrorRedirect(publicAppUrl, "redirect_mismatch");
    }
    if (lower.includes("secret") || lower.includes("client") || lower.includes("invalid")) {
      return safeErrorRedirect(publicAppUrl, "bad_credentials");
    }
    return safeErrorRedirect(publicAppUrl, "token_exchange_failed");
  }

  let accessToken = shortLived.access_token;
  let expiresIn = shortLived.expires_in || 3600;
  try {
    const longLived = await exchangeLongLivedToken({
      clientSecret,
      shortLivedToken: shortLived.access_token,
    });
    accessToken = longLived.access_token;
    expiresIn = longLived.expires_in || 60 * 24 * 3600;
  } catch (err) {
    // Keep short-lived if long-lived exchange fails; connection still works briefly.
    console.error("[socialOAuthCallback] long_lived", err?.message || err);
  }

  let profile;
  try {
    profile = await fetchInstagramProfile(accessToken);
  } catch (err) {
    console.error("[socialOAuthCallback] profile", err?.message || err);
    return safeErrorRedirect(publicAppUrl, "profile_failed");
  }

  let encrypted;
  try {
    const credentialPayload = JSON.stringify({
      access_token: accessToken,
      token_type: "bearer",
      obtained_at: new Date().toISOString(),
      expires_in: expiresIn,
    });
    encrypted = await encryptCredential(credentialPayload, encryptionKey);
  } catch (err) {
    console.error("[socialOAuthCallback] encrypt", err?.message || err);
    return safeErrorRedirect(publicAppUrl, "encrypt_failed");
  }

  const expiresAt = new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
  const connectedAt = new Date().toISOString();
  const granted = normalizeGrantedPermissions(shortLived.permissions);
  const scopeSet = new Set(granted.length ? granted : INSTAGRAM_CONNECT_SCOPES);

  // Meta sometimes omits content_publish from the permissions string even when approved.
  try {
    const publishProbe = await probeInstagramPublishCapability({
      accessToken,
      igUserId: profile.user_id,
    });
    if (publishProbe) {
      scopeSet.add("instagram_business_content_publish");
    }
    console.log(
      "[socialOAuthCallback] permissions meta=",
      granted.join(",") || "(none)",
      "probePublish=",
      publishProbe,
      "stored=",
      [...scopeSet].join(",")
    );
  } catch (err) {
    console.error("[socialOAuthCallback] publish_probe", err?.message || err);
  }

  const scopes = [...scopeSet].join(",");
  const hasPublish = scopeSet.has("instagram_business_content_publish");

  try {
    const existing = await base44.asServiceRole.entities.SocialAccount.filter(
      { user_id: boundUserId, provider: boundProvider },
      "-created_date",
      20
    );
    const active = (existing || []).filter((a) => a.status === "connected");
    for (const row of active) {
      await base44.asServiceRole.entities.SocialAccount.update(row.id, {
        status: "disconnected",
        encrypted_credentials: "",
      });
      row.status = "disconnected";
      row.encrypted_credentials = "";
    }

    const matching = (existing || []).filter(
      (a) => String(a.provider_account_id) === String(profile.user_id)
    );
    const sameAccount = matching.sort(
      (a, b) =>
        new Date(b.connected_at || b.created_date || 0).getTime() -
        new Date(a.connected_at || a.created_date || 0).getTime()
    )[0];
    const fields = {
      user_id: boundUserId,
      provider: boundProvider,
      provider_account_id: profile.user_id,
      account_name: profile.name || profile.username || "Instagram",
      username: profile.username || "",
      profile_image_url: profile.profile_picture_url || "",
      status: "connected",
      scopes,
      encrypted_credentials: encrypted,
      expires_at: expiresAt,
      connected_at: connectedAt,
    };

    if (sameAccount) {
      await base44.asServiceRole.entities.SocialAccount.update(sameAccount.id, fields);
    } else {
      await base44.asServiceRole.entities.SocialAccount.create(fields);
    }
  } catch (err) {
    console.error("[socialOAuthCallback] account_save", err?.message || err);
    return safeErrorRedirect(publicAppUrl, "account_save_failed");
  }

  if (!publicAppUrl) return configurationErrorResponse();
  if (!hasPublish) {
    return redirectToSocial(publicAppUrl, {
      social_connected: "instagram",
      social_warning: "missing_publish_scope",
    });
  }
  return redirectToSocial(publicAppUrl, { social_connected: "instagram" });
}
