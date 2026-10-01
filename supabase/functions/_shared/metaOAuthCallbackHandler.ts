/**
 * Multi-provider OAuth callback (Instagram / TikTok / YouTube).
 * Endpoint: /functions/metaCustomCallback (and legacy socialOAuthCallback).
 * Bypasses built-in Base44 social auth proxies entirely.
 */
import { createClientFromRequest } from "./runtime.ts";
import { secrets } from "./runtime.ts";
import { encryptCredential, encodeSecureFallback } from "./socialCrypto.ts";
import {
  INSTAGRAM_CONNECT_SCOPES,
  META_OAUTH_REDIRECT_URI,
  exchangeInstagramCode,
  exchangeLongLivedToken,
  fetchInstagramProfile,
  normalizeGrantedPermissions,
  probeInstagramPublishCapability,
  hasInstagramPublishScope,
} from "./instagramOAuth.ts";
import {
  TIKTOK_CONNECT_SCOPES,
  SOCIAL_OAUTH_REDIRECT_URI as TIKTOK_REDIRECT,
  exchangeTikTokCode,
  fetchTikTokProfile,
} from "./tiktokOAuth.ts";
import {
  YOUTUBE_CONNECT_SCOPES,
  SOCIAL_OAUTH_REDIRECT_URI as YT_REDIRECT,
  exchangeYouTubeCode,
  fetchYouTubeChannel,
} from "./youtubeOAuth.ts";

function requirePublicAppUrl(): string | null {
  const configured = secrets.get("PUBLIC_APP_URL") || secrets.get("APP_PUBLIC_URL");
  if (!configured || !String(configured).trim()) return null;
  return String(configured).replace(/\/$/, "");
}

function redirectToSocial(home: string, query: Record<string, string>): Response {
  return Response.redirect(`${home}/social?${new URLSearchParams(query)}`, 302);
}

function configurationErrorResponse(): Response {
  return new Response(
    "OAuth callback misconfigured: set PUBLIC_APP_URL in Base44 secrets.",
    { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}

function safeErrorRedirect(home: string | null, code: string): Response {
  if (!home) return configurationErrorResponse();
  return redirectToSocial(home, { social_error: code });
}

const MAX_DETAILS_CHARS = 600;

function truncateForQuery(value: string, max: number): string {
  const s = String(value || "");
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 3))}...`;
}

function debugFailureResponse(params: {
  home: string | null;
  step: string;
  errorType: string;
  socialErrorCode: string;
  err: unknown;
  provider?: string;
}): Response {
  const e = params.err instanceof Error ? params.err : new Error(String(params.err ?? "Unknown error"));
  const details = truncateForQuery(e.message || String(params.err), MAX_DETAILS_CHARS);
  console.error("[socialOAuthCallback] --- SOCIAL OAUTH DEBUG ERROR ---");
  console.error(
    "[socialOAuthCallback]",
    JSON.stringify({
      provider: params.provider || null,
      step: params.step,
      errorType: params.errorType,
      message: details,
    })
  );
  if (!params.home) {
    return Response.json(
      { success: false, errorType: params.errorType, step: params.step, message: details },
      { status: 500 }
    );
  }
  const query: Record<string, string> = {
    social_error: params.socialErrorCode || "provider_error",
    error: params.socialErrorCode || "provider_error",
    details,
    social_debug_step: params.step,
    social_debug_type: params.errorType,
  };
  if (params.provider) query.provider = params.provider;
  return Response.redirect(`${params.home}/social?${new URLSearchParams(query)}`, 302);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveEncryptionKey(): string | null {
  const fromSecret = secrets.get("SOCIAL_TOKEN_ENCRYPTION_KEY");
  let fromEnv: string | undefined;
  try {
    fromEnv = (globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno?.env?.get?.(
      "SOCIAL_TOKEN_ENCRYPTION_KEY"
    );
  } catch {
    /* ignore */
  }
  return String(fromSecret || fromEnv || "").trim() || null;
}

async function findOAuthState(
  base44: ReturnType<typeof createClientFromRequest>,
  state: string
): Promise<Record<string, unknown> | null> {
  for (let i = 0; i < 5; i++) {
    try {
      const states = await base44.asServiceRole.entities.SocialOAuthState.filter(
        { state },
        "-created_date",
        5
      );
      if ((states || [])[0]) return states[0] as Record<string, unknown>;
    } catch (err) {
      console.warn("[socialOAuthCallback] state_lookup", i, (err as Error)?.message || err);
    }
    await sleep(200 * (i + 1));
  }
  return null;
}

async function encryptPayload(plaintext: string, encryptionKey: string): Promise<string> {
  try {
    return await encryptCredential(plaintext, encryptionKey);
  } catch (err) {
    console.error("[socialOAuthCallback] encrypt fallback", (err as Error)?.message || err);
    return encodeSecureFallback(plaintext);
  }
}

async function upsertSocialAccount(
  base44: ReturnType<typeof createClientFromRequest>,
  fields: Record<string, unknown>
): Promise<void> {
  const userId = String(fields.user_id);
  const provider = String(fields.provider);
  const providerAccountId = String(fields.provider_account_id);
  const existing = await base44.asServiceRole.entities.SocialAccount.filter(
    { user_id: userId, provider },
    "-created_date",
    20
  );
  for (const row of (existing || []).filter((a) => a.status === "connected")) {
    await base44.asServiceRole.entities.SocialAccount.update(row.id, {
      status: "disconnected",
      encrypted_credentials: "",
    }).catch(() => {});
  }
  const same = (existing || []).find(
    (a) => a.provider_account_id != null && String(a.provider_account_id) === providerAccountId
  );
  if (same?.id) {
    await base44.asServiceRole.entities.SocialAccount.update(same.id, fields);
  } else {
    await base44.asServiceRole.entities.SocialAccount.create(fields);
  }
}

async function handleInstagramConnect(params: {
  base44: ReturnType<typeof createClientFromRequest>;
  code: string;
  boundUserId: string;
  home: string | null;
  encryptionKey: string;
}): Promise<Response> {
  const clientId = secrets.get("META_CLIENT_ID");
  const clientSecret = secrets.get("META_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return debugFailureResponse({
      home: params.home,
      step: "config",
      errorType: "NOT_CONFIGURED",
      socialErrorCode: "not_configured",
      provider: "instagram",
      err: new Error("Missing META_CLIENT_ID / META_CLIENT_SECRET"),
    });
  }

  let shortLived;
  try {
    shortLived = await exchangeInstagramCode({
      clientId,
      clientSecret,
      redirectUri: META_OAUTH_REDIRECT_URI,
      code: params.code,
    });
  } catch (err) {
    return debugFailureResponse({
      home: params.home,
      step: "token_exchange",
      errorType: "TOKEN_EXCHANGE_FAILED",
      socialErrorCode: "token_exchange_failed",
      provider: "instagram",
      err,
    });
  }

  let igUserId = shortLived.user_id ? String(shortLived.user_id) : "";
  let accessToken = shortLived.access_token;
  let expiresIn = shortLived.expires_in || 3600;
  try {
    const longLived = await exchangeLongLivedToken({
      clientId,
      clientSecret,
      shortLivedToken: shortLived.access_token,
    });
    accessToken = longLived.access_token;
    expiresIn = longLived.expires_in || 60 * 24 * 3600;
  } catch (err) {
    console.warn("[socialOAuthCallback] ig long_lived warning", (err as Error)?.message || err);
  }

  let username = "";
  let displayName = "";
  let profileImageUrl = "";
  try {
    const profile = await fetchInstagramProfile(accessToken);
    if (profile.user_id) igUserId = String(profile.user_id).trim() || igUserId;
    username = profile.username || "";
    displayName = profile.name || "";
    profileImageUrl = profile.profile_picture_url || "";
  } catch (err) {
    console.warn("[socialOAuthCallback] ig profile warning", (err as Error)?.message || err);
  }

  if (!igUserId) {
    return debugFailureResponse({
      home: params.home,
      step: "instagram_id_extraction",
      errorType: "PROFILE_FAILED",
      socialErrorCode: "profile_failed",
      provider: "instagram",
      err: new Error("instagram user_id missing from token payload"),
    });
  }

  const encrypted = await encryptPayload(
    JSON.stringify({
      access_token: accessToken,
      ig_user_id: igUserId,
      token_type: "bearer",
      auth_type: "instagram_login",
      obtained_at: new Date().toISOString(),
      expires_in: expiresIn,
    }),
    params.encryptionKey
  );

  const granted = normalizeGrantedPermissions(shortLived.permissions);
  const scopeSet = new Set(granted.length ? granted : INSTAGRAM_CONNECT_SCOPES);
  try {
    if (await probeInstagramPublishCapability({ accessToken, igUserId })) {
      scopeSet.add("instagram_business_content_publish");
    }
  } catch {
    /* ignore */
  }
  const scopes = [...scopeSet].join(",");

  await upsertSocialAccount(params.base44, {
    user_id: params.boundUserId,
    provider: "instagram",
    provider_account_id: igUserId,
    account_name: displayName || username || "Instagram",
    username,
    profile_image_url: profileImageUrl,
    status: "connected",
    scopes,
    encrypted_credentials: encrypted,
    expires_at: new Date(Date.now() + Number(expiresIn) * 1000).toISOString(),
    connected_at: new Date().toISOString(),
  });

  if (!params.home) return configurationErrorResponse();
  if (!hasInstagramPublishScope(scopes)) {
    return redirectToSocial(params.home, {
      social_connected: "instagram",
      social_warning: "missing_publish_scope",
    });
  }
  return redirectToSocial(params.home, { social_connected: "instagram" });
}

async function handleTikTokConnect(params: {
  base44: ReturnType<typeof createClientFromRequest>;
  code: string;
  boundUserId: string;
  home: string | null;
  encryptionKey: string;
}): Promise<Response> {
  const clientKey = secrets.get("TIKTOK_CLIENT_KEY") || secrets.get("TIKTOK_CLIENT_ID");
  const clientSecret = secrets.get("TIKTOK_CLIENT_SECRET");
  if (!clientKey || !clientSecret) {
    return debugFailureResponse({
      home: params.home,
      step: "config",
      errorType: "NOT_CONFIGURED",
      socialErrorCode: "not_configured",
      provider: "tiktok",
      err: new Error("Missing TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET"),
    });
  }

  let token;
  try {
    token = await exchangeTikTokCode({
      clientKey,
      clientSecret,
      code: params.code,
      redirectUri: TIKTOK_REDIRECT,
    });
  } catch (err) {
    return debugFailureResponse({
      home: params.home,
      step: "token_exchange",
      errorType: "TOKEN_EXCHANGE_FAILED",
      socialErrorCode: "token_exchange_failed",
      provider: "tiktok",
      err,
    });
  }

  let openId = token.open_id || "";
  let displayName = "";
  let username = "";
  let avatar = "";
  try {
    const profile = await fetchTikTokProfile(token.access_token);
    openId = profile.open_id || openId;
    displayName = profile.display_name || "";
    username = profile.username || "";
    avatar = profile.avatar_url || "";
    console.log(
      "[socialOAuthCallback] tiktok profile",
      JSON.stringify({
        openId: Boolean(openId),
        displayName: Boolean(displayName),
        username: Boolean(username),
        avatar: Boolean(avatar),
      })
    );
  } catch (err) {
    console.warn("[socialOAuthCallback] tiktok profile warning", (err as Error)?.message || err);
  }
  if (!openId) {
    return debugFailureResponse({
      home: params.home,
      step: "profile",
      errorType: "PROFILE_FAILED",
      socialErrorCode: "profile_failed",
      provider: "tiktok",
      err: new Error("TikTok open_id missing"),
    });
  }

  const expiresIn = token.expires_in || 86400;
  const encrypted = await encryptPayload(
    JSON.stringify({
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      open_id: openId,
      token_type: "bearer",
      auth_type: "tiktok_login",
      obtained_at: new Date().toISOString(),
      expires_in: expiresIn,
      refresh_expires_in: token.refresh_expires_in || null,
    }),
    params.encryptionKey
  );

  await upsertSocialAccount(params.base44, {
    user_id: params.boundUserId,
    provider: "tiktok",
    provider_account_id: openId,
    account_name: displayName || username || "TikTok",
    username: username || displayName || "",
    profile_image_url: avatar,
    status: "connected",
    scopes: token.scope || TIKTOK_CONNECT_SCOPES.join(","),
    encrypted_credentials: encrypted,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    connected_at: new Date().toISOString(),
  });

  if (!params.home) return configurationErrorResponse();
  return redirectToSocial(params.home, { social_connected: "tiktok" });
}

async function handleYouTubeConnect(params: {
  base44: ReturnType<typeof createClientFromRequest>;
  code: string;
  boundUserId: string;
  home: string | null;
  encryptionKey: string;
}): Promise<Response> {
  const clientId = secrets.get("GOOGLE_CLIENT_ID") || secrets.get("YOUTUBE_CLIENT_ID");
  const clientSecret = secrets.get("GOOGLE_CLIENT_SECRET") || secrets.get("YOUTUBE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return debugFailureResponse({
      home: params.home,
      step: "config",
      errorType: "NOT_CONFIGURED",
      socialErrorCode: "not_configured",
      provider: "youtube",
      err: new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET"),
    });
  }

  let token;
  try {
    token = await exchangeYouTubeCode({
      clientId,
      clientSecret,
      code: params.code,
      redirectUri: YT_REDIRECT,
    });
  } catch (err) {
    return debugFailureResponse({
      home: params.home,
      step: "token_exchange",
      errorType: "TOKEN_EXCHANGE_FAILED",
      socialErrorCode: "token_exchange_failed",
      provider: "youtube",
      err,
    });
  }

  let channel;
  try {
    channel = await fetchYouTubeChannel(token.access_token);
  } catch (err) {
    return debugFailureResponse({
      home: params.home,
      step: "profile",
      errorType: "PROFILE_FAILED",
      socialErrorCode: "profile_failed",
      provider: "youtube",
      err,
    });
  }

  const expiresIn = token.expires_in || 3600;
  const encrypted = await encryptPayload(
    JSON.stringify({
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      channel_id: channel.channel_id,
      token_type: "bearer",
      auth_type: "google_youtube",
      obtained_at: new Date().toISOString(),
      expires_in: expiresIn,
      scope: token.scope || YOUTUBE_CONNECT_SCOPES.join(" "),
    }),
    params.encryptionKey
  );

  await upsertSocialAccount(params.base44, {
    user_id: params.boundUserId,
    provider: "youtube",
    provider_account_id: channel.channel_id,
    account_name: channel.title || "YouTube",
    username: channel.custom_url || "",
    profile_image_url: channel.thumbnail_url || "",
    status: "connected",
    scopes: token.scope || YOUTUBE_CONNECT_SCOPES.join(" "),
    encrypted_credentials: encrypted,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    connected_at: new Date().toISOString(),
  });

  if (!params.home) return configurationErrorResponse();
  return redirectToSocial(params.home, { social_connected: "youtube" });
}

/**
 * OAuth callback HTTP handler (GET). Provider is taken from SocialOAuthState.
 * POST is not used for OAuth — publishing stays in socialPublish.
 */
export default async function (req: Request): Promise<Response> {
  const publicAppUrl = requirePublicAppUrl();

  if (req.method === "POST") {
    return Response.json(
      {
        error:
          "OAuth callback accepts GET only. Publish via socialPublish; analytics via socialStatsSync.",
        code: "METHOD_NOT_ALLOWED",
      },
      { status: 405 }
    );
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      return debugFailureResponse({
        home: publicAppUrl,
        step: "authorize",
        errorType: "PROVIDER_DENIED",
        socialErrorCode: error === "access_denied" ? "cancelled" : "provider_error",
        err: new Error(String(errorDescription || error)),
      });
    }
    if (!code || !state) {
      return safeErrorRedirect(publicAppUrl, "invalid_response");
    }

    const encryptionKey = resolveEncryptionKey();
    if (!encryptionKey) {
      return debugFailureResponse({
        home: publicAppUrl,
        step: "config",
        errorType: "NOT_CONFIGURED",
        socialErrorCode: "not_configured",
        err: new Error("SOCIAL_TOKEN_ENCRYPTION_KEY missing"),
      });
    }

    let base44;
    try {
      base44 = createClientFromRequest(req);
    } catch (err) {
      return debugFailureResponse({
        home: publicAppUrl,
        step: "client_init",
        errorType: "CLIENT_INIT_FAILED",
        socialErrorCode: "client_init_failed",
        err,
      });
    }

    const record = await findOAuthState(base44, state);
    let boundUserId: string | null = record?.user_id != null ? String(record.user_id) : null;
    let provider = record?.provider != null ? String(record.provider) : "instagram";

    if (record?.id) {
      if (record.used) return safeErrorRedirect(publicAppUrl, "state_reused");
      if (record.expires_at && new Date(String(record.expires_at)).getTime() < Date.now()) {
        await base44.asServiceRole.entities.SocialOAuthState.delete(String(record.id)).catch(() => {});
        return safeErrorRedirect(publicAppUrl, "expired_state");
      }
      await base44.asServiceRole.entities.SocialOAuthState.delete(String(record.id)).catch(() => {});
    }

    if (!boundUserId) {
      try {
        const sessionUser = await base44.auth.me();
        if (sessionUser?.id) boundUserId = String(sessionUser.id);
      } catch {
        /* ignore */
      }
    }
    if (!boundUserId) {
      return debugFailureResponse({
        home: publicAppUrl,
        step: "state_or_session_bind",
        errorType: "INVALID_STATE",
        socialErrorCode: "invalid_state",
        err: new Error("Cannot bind SocialAccount — no OAuth state user and no session"),
      });
    }

    const ctx = {
      base44,
      code,
      boundUserId,
      home: publicAppUrl,
      encryptionKey,
    };

    if (provider === "tiktok") return await handleTikTokConnect(ctx);
    if (provider === "youtube") return await handleYouTubeConnect(ctx);
    return await handleInstagramConnect(ctx);
  } catch (err) {
    return debugFailureResponse({
      home: publicAppUrl,
      step: "unhandled",
      errorType: "BACKEND_CRASH",
      socialErrorCode: "provider_error",
      err,
    });
  }
}
