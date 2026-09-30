/**
 * Instagram / Meta Business Login helpers.
 * Official endpoints: Instagram Platform — Instagram Login.
 * Scopes: account identification + content publishing (no analytics).
 * Docs: Content Publishing requires instagram_business_content_publish.
 */

export const INSTAGRAM_CONNECT_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
];

/** True when stored scopes include publishing permission. */
export function hasInstagramPublishScope(scopes: string | null | undefined): boolean {
  const raw = String(scopes || "");
  const parts = raw.split(/[,\s]+/).filter(Boolean);
  return (
    parts.includes("instagram_business_content_publish") ||
    // Legacy Instagram Login scope name (deprecated, still seen in some responses)
    parts.includes("business_content_publish")
  );
}

/**
 * Live check: can this token call Content Publishing APIs?
 * Used when Meta's permissions field omits publish even though the user approved it.
 */
export async function probeInstagramPublishCapability(params: {
  accessToken: string;
  igUserId: string;
}): Promise<boolean> {
  const q = new URLSearchParams({ access_token: params.accessToken });
  const url = `https://graph.instagram.com/v21.0/${encodeURIComponent(params.igUserId)}/content_publishing_limit?${q}`;
  try {
    const res = await fetch(url);
    if (res.ok) return true;
    const data = await res.json().catch(() => ({}));
    const msg = String(data?.error?.message || data?.error_message || "");
    // Explicit permission / OAuth errors → no publish capability
    if (/permission|oauth|#10|#200/i.test(msg)) return false;
    // Other errors (rate limit, transient) do not prove missing publish scope
    return false;
  } catch {
    return false;
  }
}

export type InstagramTokenBundle = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  user_id?: string | number;
  permissions?: string[];
};

export type InstagramProfile = {
  user_id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
};

/** Normalize Meta permissions field (comma string or array) into a stable list. */
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

export function buildInstagramAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
  /** When true, Instagram forces credential re-entry so new scopes can be granted. */
  forceReauth?: boolean;
}): string {
  const scopes = (params.scopes || INSTAGRAM_CONNECT_SCOPES).join(",");
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: scopes,
    response_type: "code",
    state: params.state,
  });
  if (params.forceReauth) {
    q.set("force_reauth", "true");
  }
  return `https://www.instagram.com/oauth/authorize?${q.toString()}`;
}

/** Exchange authorization code for short-lived Instagram User token. */
export async function exchangeInstagramCode(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<InstagramTokenBundle> {
  // Instagram sometimes appends "#_" to the redirect; never send that as part of the code.
  const code = String(params.code || "").replace(/#_+$/, "").trim();
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri,
    code,
  });
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  // Meta may return a flat object or { data: [{ access_token, permissions, user_id }] }.
  const tokenObj = Array.isArray(data?.data) ? data.data[0] : data;
  if (!res.ok || !tokenObj?.access_token) {
    const metaMsg = String(
      data?.error_message || data?.error?.message || tokenObj?.error_message || ""
    ).slice(0, 180);
    throw new Error(
      metaMsg
        ? `token_exchange: ${metaMsg}`
        : `token_exchange: HTTP ${res.status}`
    );
  }
  const permissions = normalizeGrantedPermissions(tokenObj.permissions);
  return {
    access_token: String(tokenObj.access_token),
    token_type: tokenObj.token_type,
    expires_in: tokenObj.expires_in,
    user_id: tokenObj.user_id,
    permissions: permissions.length ? permissions : undefined,
  };
}

/** Exchange short-lived token for long-lived token (~60 days). */
export async function exchangeLongLivedToken(params: {
  clientSecret: string;
  shortLivedToken: string;
}): Promise<InstagramTokenBundle> {
  const q = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: params.clientSecret,
    access_token: params.shortLivedToken,
  });
  const res = await fetch(`https://graph.instagram.com/access_token?${q.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const metaMsg = String(data?.error?.message || data?.error_message || "").slice(0, 180);
    throw new Error(metaMsg ? `long_lived: ${metaMsg}` : "Long-lived token exchange failed");
  }
  return data as InstagramTokenBundle;
}

/** Load basic professional account profile. */
export async function fetchInstagramProfile(accessToken: string): Promise<InstagramProfile> {
  const q = new URLSearchParams({
    fields: "user_id,username,name,profile_picture_url",
    access_token: accessToken,
  });
  const res = await fetch(`https://graph.instagram.com/v21.0/me?${q.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !(data.user_id || data.id)) {
    const metaMsg = String(data?.error?.message || data?.error_message || "").slice(0, 180);
    throw new Error(metaMsg ? `profile: ${metaMsg}` : "Account lookup failed");
  }
  return {
    user_id: String(data.user_id || data.id),
    username: data.username,
    name: data.name,
    profile_picture_url: data.profile_picture_url,
  };
}

/**
 * Instagram does not document a public token-revoke endpoint equivalent to
 * Facebook's /me/permissions DELETE for Instagram User tokens in all setups.
 * Disconnect deletes local credentials; user can also remove the app in Instagram settings.
 */
export async function revokeInstagramAccess(_accessToken: string): Promise<{ attempted: boolean; revoked: boolean }> {
  return { attempted: false, revoked: false };
}
