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
import { SOCIAL_OAUTH_REDIRECT_URI as YT_REDIRECT } from "./youtubeOAuth.ts";
import { completeYouTubeConnect } from "./youtubeConnectCore.ts";
import { findOAuthState } from "./socialOAuthState.ts";
import {
  exchangeFacebookCode,
  exchangeFacebookLongLived,
  FB_GRAPH,
  FACEBOOK_CONNECT_SCOPES,
  FACEBOOK_OAUTH_REDIRECT_URI,
  facebookPagePublicUrl,
  fetchFacebookPages,
  hasFacebookPublishScope,
} from "./facebookOAuth.ts";
import {
  exchangeXCode,
  fetchXProfile,
  hasXPublishScope,
  X_CONNECT_SCOPES,
  X_OAUTH_REDIRECT_URI,
  xPublicProfileUrl,
} from "./xOAuth.ts";

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
  const artistId = String(fields.artist_id || "").trim();
  if (!artistId) {
    throw new Error("artist_id is required for social connections");
  }
  const existing = await base44.asServiceRole.entities.SocialAccount.filter(
    { user_id: userId, provider },
    "-created_date",
    20
  );
  for (const row of (existing || []).filter((a) => {
    if (a.status !== "connected") return false;
    return String(a.artist_id || "").trim() === artistId;
  })) {
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
  boundArtistId?: string;
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
    artist_id: params.boundArtistId || "",
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
  boundArtistId?: string;
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
    artist_id: params.boundArtistId || "",
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
  boundArtistId?: string;
  home: string | null;
  encryptionKey: string;
  oauthClientId?: string | null;
  oauthRedirectUri?: string | null;
}): Promise<Response> {
  const redirectUri = String(params.oauthRedirectUri || "").trim() || YT_REDIRECT;
  try {
    await completeYouTubeConnect({
      base44: params.base44,
      code: params.code,
      boundUserId: params.boundUserId,
      boundArtistId: params.boundArtistId || "",
      encryptionKey: params.encryptionKey,
      redirectUri,
      oauthClientId: params.oauthClientId,
    });
  } catch (err) {
    const message = (err as Error)?.message || String(err);
    const step = /not configured/i.test(message) ? "config" : "token_exchange";
    return debugFailureResponse({
      home: params.home,
      step,
      errorType: step === "config" ? "NOT_CONFIGURED" : "TOKEN_EXCHANGE_FAILED",
      socialErrorCode: step === "config" ? "not_configured" : "token_exchange_failed",
      provider: "youtube",
      err,
    });
  }

  if (!params.home) return configurationErrorResponse();
  return redirectToSocial(params.home, { social_connected: "youtube" });
}

async function handleFacebookConnect(params: {
  base44: ReturnType<typeof createClientFromRequest>;
  code: string;
  boundUserId: string;
  boundArtistId?: string;
  home: string | null;
  encryptionKey: string;
}): Promise<Response> {
  const clientId = secrets.get("FACEBOOK_CLIENT_ID");
  const clientSecret = secrets.get("FACEBOOK_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return debugFailureResponse({
      home: params.home,
      step: "config",
      errorType: "NOT_CONFIGURED",
      socialErrorCode: "not_configured",
      provider: "facebook",
      err: new Error("Missing FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET"),
    });
  }

  let shortLived;
  try {
    shortLived = await exchangeFacebookCode({
      clientId,
      clientSecret,
      redirectUri: FACEBOOK_OAUTH_REDIRECT_URI,
      code: params.code,
    });
  } catch (err) {
    return debugFailureResponse({
      home: params.home,
      step: "token_exchange",
      errorType: "TOKEN_EXCHANGE_FAILED",
      socialErrorCode: "token_exchange_failed",
      provider: "facebook",
      err,
    });
  }

  let userToken = shortLived.access_token;
  let expiresIn = shortLived.expires_in || 3600;
  try {
    const long = await exchangeFacebookLongLived({
      clientId,
      clientSecret,
      shortLivedToken: userToken,
    });
    userToken = long.access_token;
    expiresIn = long.expires_in || expiresIn;
  } catch (err) {
    console.warn("[socialOAuthCallback] fb long_lived warning", (err as Error)?.message || err);
  }

  let pages;
  try {
    pages = await fetchFacebookPages(userToken);
  } catch (err) {
    return debugFailureResponse({
      home: params.home,
      step: "profile",
      errorType: "PROFILE_FAILED",
      socialErrorCode: "profile_failed",
      provider: "facebook",
      err,
    });
  }

  if (!pages.length) {
    return debugFailureResponse({
      home: params.home,
      step: "facebook_pages",
      errorType: "NO_PAGES",
      socialErrorCode: "no_facebook_pages",
      provider: "facebook",
      err: new Error("No Facebook Pages found. Create or admin a Page, then connect again."),
    });
  }

  const page = pages[0];
  let grantedScopes = FACEBOOK_CONNECT_SCOPES.join(",");
  try {
    const dbg = await fetch(
      `${FB_GRAPH}/debug_token?${new URLSearchParams({
        input_token: userToken,
        access_token: `${clientId}|${clientSecret}`,
      })}`
    );
    const dbgJson = await dbg.json().catch(() => ({}));
    const raw = dbgJson?.data?.scopes;
    if (Array.isArray(raw) && raw.length) grantedScopes = raw.join(",");
  } catch {
    /* ignore */
  }
  const scopes = grantedScopes;
  const encrypted = await encryptPayload(
    JSON.stringify({
      page_access_token: page.access_token,
      page_id: page.id,
      user_access_token: userToken,
      auth_type: "facebook_page",
      obtained_at: new Date().toISOString(),
      expires_in: expiresIn,
      page_url: facebookPagePublicUrl(page),
    }),
    params.encryptionKey
  );

  await upsertSocialAccount(params.base44, {
    user_id: params.boundUserId,
    artist_id: params.boundArtistId || "",
    provider: "facebook",
    provider_account_id: page.id,
    account_name: page.name,
    username: page.username || page.id,
    profile_image_url: page.picture_url || "",
    status: "connected",
    scopes,
    encrypted_credentials: encrypted,
    expires_at: new Date(Date.now() + Number(expiresIn) * 1000).toISOString(),
    connected_at: new Date().toISOString(),
  });

  if (!params.home) return configurationErrorResponse();
  if (!hasFacebookPublishScope(scopes)) {
    return redirectToSocial(params.home, {
      social_connected: "facebook",
      social_warning: "missing_publish_scope",
    });
  }
  return redirectToSocial(params.home, { social_connected: "facebook" });
}

async function handleXConnect(params: {
  base44: ReturnType<typeof createClientFromRequest>;
  code: string;
  boundUserId: string;
  boundArtistId?: string;
  home: string | null;
  encryptionKey: string;
  codeVerifier: string;
}): Promise<Response> {
  const clientId =
    secrets.get("X_CLIENT_ID") ||
    secrets.get("TWITTER_CLIENT_ID") ||
    secrets.get("X_API_KEY");
  const clientSecret =
    secrets.get("X_CLIENT_SECRET") ||
    secrets.get("TWITTER_CLIENT_SECRET") ||
    secrets.get("X_API_SECRET");
  if (!clientId || !clientSecret) {
    return debugFailureResponse({
      home: params.home,
      step: "config",
      errorType: "NOT_CONFIGURED",
      socialErrorCode: "not_configured",
      provider: "x",
      err: new Error("Missing X_CLIENT_ID / X_CLIENT_SECRET"),
    });
  }
  if (!params.codeVerifier) {
    return debugFailureResponse({
      home: params.home,
      step: "pkce",
      errorType: "INVALID_STATE",
      socialErrorCode: "invalid_state",
      provider: "x",
      err: new Error("Missing PKCE code verifier for X OAuth"),
    });
  }

  let token;
  try {
    token = await exchangeXCode({
      clientId,
      clientSecret,
      redirectUri: X_OAUTH_REDIRECT_URI,
      code: params.code,
      codeVerifier: params.codeVerifier,
    });
  } catch (err) {
    return debugFailureResponse({
      home: params.home,
      step: "token_exchange",
      errorType: "TOKEN_EXCHANGE_FAILED",
      socialErrorCode: "token_exchange_failed",
      provider: "x",
      err,
    });
  }

  let profile;
  try {
    profile = await fetchXProfile(token.access_token);
  } catch (err) {
    return debugFailureResponse({
      home: params.home,
      step: "profile",
      errorType: "PROFILE_FAILED",
      socialErrorCode: "profile_failed",
      provider: "x",
      err,
    });
  }

  const expiresIn = token.expires_in || 7200;
  const encrypted = await encryptPayload(
    JSON.stringify({
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      user_id: profile.id,
      token_type: token.token_type || "bearer",
      auth_type: "x_oauth2",
      obtained_at: new Date().toISOString(),
      expires_in: expiresIn,
      profile_url: xPublicProfileUrl(profile.username),
    }),
    params.encryptionKey
  );

  await upsertSocialAccount(params.base44, {
    user_id: params.boundUserId,
    artist_id: params.boundArtistId || "",
    provider: "x",
    provider_account_id: profile.id,
    account_name: profile.name,
    username: profile.username,
    profile_image_url: profile.profile_image_url,
    status: "connected",
    scopes: token.scope || X_CONNECT_SCOPES.join(" "),
    encrypted_credentials: encrypted,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    connected_at: new Date().toISOString(),
  });

  if (!params.home) return configurationErrorResponse();
  if (!hasXPublishScope(token.scope)) {
    return redirectToSocial(params.home, {
      social_connected: "x",
      social_warning: "missing_publish_scope",
    });
  }
  return redirectToSocial(params.home, { social_connected: "x" });
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
    const oauthClientId =
      record?.oauth_client_id != null ? String(record.oauth_client_id).trim() : "";
    const oauthRedirectUri =
      record?.oauth_redirect_uri != null ? String(record.oauth_redirect_uri).trim() : "";
    const oauthCodeVerifier =
      record?.oauth_code_verifier != null ? String(record.oauth_code_verifier).trim() : "";
    let boundUserId: string | null = record?.user_id != null ? String(record.user_id) : null;
    const boundArtistId =
      record?.artist_id != null ? String(record.artist_id).trim() : "";
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
    if (!boundArtistId) {
      return debugFailureResponse({
        home: publicAppUrl,
        step: "artist_scope",
        errorType: "ARTIST_REQUIRED",
        socialErrorCode: "artist_required",
        err: new Error("OAuth state missing artist_id — reconnect from Social Hub with an artist selected"),
      });
    }

    const ctx = {
      base44,
      code,
      boundUserId,
      boundArtistId,
      home: publicAppUrl,
      encryptionKey,
    };

    if (provider === "tiktok") return await handleTikTokConnect(ctx);
    if (provider === "youtube") {
      return await handleYouTubeConnect({
        ...ctx,
        oauthClientId: oauthClientId || null,
        oauthRedirectUri: oauthRedirectUri || null,
      });
    }
    if (provider === "facebook") return await handleFacebookConnect(ctx);
    if (provider === "x" || provider === "twitter") {
      return await handleXConnect({ ...ctx, codeVerifier: oauthCodeVerifier });
    }
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
