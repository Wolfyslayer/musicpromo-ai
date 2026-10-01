/**
 * Instagram Connect via Instagram Login for Business (no Facebook Page required).
 * Authorize: www.instagram.com → short-lived token on api.instagram.com →
 * long-lived token + Graph calls on graph.instagram.com.
 */

export const IG_API_VERSION = "v21.0";
/** Business Login authorize host (Instagram OAuth dialog). */
export const IG_OAUTH_AUTHORIZE = "https://www.instagram.com/oauth/authorize";
/** Short-lived token exchange host. */
export const IG_OAUTH_TOKEN = "https://api.instagram.com/oauth/access_token";
/** Instagram Graph API host for tokens, profile, and publishing. */
export const IG_GRAPH = "https://graph.instagram.com";

/**
 * Explicit custom Base44 function endpoint for Instagram OAuth redirects.
 * Must match Meta App Dashboard → Valid OAuth Redirect URIs exactly.
 * Bypasses any generic / built-in Base44 social auth callback paths.
 */
export const META_OAUTH_REDIRECT_URI =
  "https://flying-sonic-promo-flow.base44.app/functions/metaCustomCallback";

/**
 * Native Instagram Business Login scopes only — no Facebook Graph / Page strings.
 * Must match Meta App Dashboard → Instagram Login permissions exactly.
 */
export const INSTAGRAM_CONNECT_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
] as const;

/** True when stored scopes include Instagram content publishing. */
export function hasInstagramPublishScope(scopes: string | null | undefined): boolean {
  const raw = String(scopes || "");
  const parts = raw.split(/[,\s]+/).filter(Boolean);
  return (
    parts.includes("instagram_business_content_publish") ||
    parts.includes("business_content_publish") ||
    // Legacy Facebook-Login scope (pre Instagram-Login migration)
    parts.includes("instagram_content_publish")
  );
}

export type InstagramTokenBundle = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  /** Instagram user id from the token exchange payload (`user_id`). */
  user_id?: string;
  permissions?: string[];
};

export type InstagramProfile = {
  user_id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
};

/** Normalize Meta / Instagram permissions field (comma string or array) into a stable list. */
export function normalizeGrantedPermissions(
  raw: string | string[] | null | undefined
): string[] {
  if (Array.isArray(raw)) {
    return raw.map((p) => String(p).trim()).filter(Boolean);
  }
  return String(raw || "")
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Resolve OAuth redirect URI for Instagram Login.
 * Always returns the explicit custom function endpoint (metaCustomCallback).
 */
export function resolveMetaRedirectUri(
  ..._candidates: Array<string | null | undefined>
): string {
  return META_OAUTH_REDIRECT_URI;
}

/** @deprecated Use META_OAUTH_REDIRECT_URI — kept so older call sites compile. */
export function readMetaRedirectUriFromProcessEnv(): string | null {
  return META_OAUTH_REDIRECT_URI;
}

/**
 * Build Instagram Business Login authorize URL (www.instagram.com).
 * Always uses META_OAUTH_REDIRECT_URI.
 */
export function buildInstagramAuthorizeUrl(params: {
  clientId: string;
  /** Ignored — redirect is always META_OAUTH_REDIRECT_URI. */
  redirectUri?: string;
  state: string;
  scopes?: string[];
  forceReauth?: boolean;
}): string {
  const scopes = (params.scopes || INSTAGRAM_CONNECT_SCOPES).join(",");
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: META_OAUTH_REDIRECT_URI,
    state: params.state,
    scope: scopes,
    response_type: "code",
  });
  if (params.forceReauth) {
    q.set("force_reauth", "true");
  }
  return `${IG_OAUTH_AUTHORIZE}?${q.toString()}`;
}

/** Extract a readable Instagram / Meta API error message from a JSON body. */
export function formatInstagramApiError(
  data: Record<string, unknown> | null | undefined,
  fallback: string
): string {
  if (!data || typeof data !== "object") return fallback;
  const err = data.error as Record<string, unknown> | string | undefined;
  if (typeof err === "string" && err.trim()) return err.trim().slice(0, 300);
  if (err && typeof err === "object") {
    const msg = String(err.message || err.error_user_msg || "").trim();
    if (msg) return msg.slice(0, 300);
  }
  const errorMessage = String(data.error_message || data.error_description || "").trim();
  if (errorMessage) return errorMessage.slice(0, 300);
  return fallback;
}

/**
 * Exchange authorization code for a short-lived Instagram User access token.
 * POST https://api.instagram.com/oauth/access_token
 * Response includes access_token + user_id (instagram_user_id) + permissions.
 */
export async function exchangeInstagramCode(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<InstagramTokenBundle> {
  const code = String(params.code || "").replace(/#_+$/, "").trim();
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri,
    code,
  });
  const res = await fetch(IG_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));

  // Meta may return a flat object or { data: [ { access_token, user_id, ... } ] }.
  const row =
    Array.isArray(data?.data) && data.data[0] && typeof data.data[0] === "object"
      ? data.data[0]
      : data;

  if (!res.ok || !row?.access_token) {
    throw new Error(
      `token_exchange: ${formatInstagramApiError(data, `HTTP ${res.status}`)}`
    );
  }

  const userId =
    row.user_id != null
      ? String(row.user_id).trim()
      : row.instagram_user_id != null
        ? String(row.instagram_user_id).trim()
        : undefined;

  return {
    access_token: String(row.access_token),
    token_type: row.token_type != null ? String(row.token_type) : undefined,
    expires_in: row.expires_in != null ? Number(row.expires_in) : 3600,
    user_id: userId || undefined,
    permissions: normalizeGrantedPermissions(row.permissions),
  };
}

/**
 * Exchange short-lived Instagram User token for a long-lived token (~60 days).
 * GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token
 */
export async function exchangeLongLivedToken(params: {
  clientId: string;
  clientSecret: string;
  shortLivedToken: string;
}): Promise<InstagramTokenBundle> {
  const q = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: params.clientSecret,
    access_token: params.shortLivedToken,
  });
  const res = await fetch(`${IG_GRAPH}/access_token?${q}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      `long_lived: ${formatInstagramApiError(data, "Long-lived token exchange failed")}`
    );
  }
  return {
    access_token: String(data.access_token),
    token_type: data.token_type != null ? String(data.token_type) : "bearer",
    expires_in: data.expires_in != null ? Number(data.expires_in) : 60 * 24 * 3600,
  };
}

/**
 * Optional profile enrichment after token exchange (username / avatar).
 * Does not require a Facebook Page.
 */
export async function fetchInstagramProfile(accessToken: string): Promise<InstagramProfile> {
  const q = new URLSearchParams({
    fields: "user_id,username,name,profile_picture_url",
    access_token: accessToken,
  });
  const res = await fetch(`${IG_GRAPH}/${IG_API_VERSION}/me?${q}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(
      `profile: ${formatInstagramApiError(data, "Failed to load Instagram profile")}`
    );
  }
  const userId =
    data.user_id != null
      ? String(data.user_id).trim()
      : data.id != null
        ? String(data.id).trim()
        : "";
  if (!userId) {
    throw new Error("profile: Instagram user_id missing from /me response");
  }
  return {
    user_id: userId,
    username: data.username != null ? String(data.username) : undefined,
    name: data.name != null ? String(data.name) : undefined,
    profile_picture_url:
      data.profile_picture_url != null ? String(data.profile_picture_url) : undefined,
  };
}

/** Live check that Content Publishing is callable for this IG user. */
export async function probeInstagramPublishCapability(params: {
  accessToken: string;
  igUserId: string;
}): Promise<boolean> {
  const q = new URLSearchParams({ access_token: params.accessToken });
  const url = `${IG_GRAPH}/${IG_API_VERSION}/${encodeURIComponent(params.igUserId)}/content_publishing_limit?${q}`;
  try {
    const res = await fetch(url);
    if (res.ok) return true;
    return false;
  } catch {
    return false;
  }
}

/** Best-effort revoke of Instagram user permissions. */
export async function revokeInstagramAccess(
  accessToken: string
): Promise<{ attempted: boolean; revoked: boolean }> {
  try {
    const res = await fetch(`${IG_GRAPH}/${IG_API_VERSION}/me/permissions`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { attempted: true, revoked: res.ok };
  } catch {
    return { attempted: true, revoked: false };
  }
}
