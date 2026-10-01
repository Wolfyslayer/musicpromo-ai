/**
 * Social Hub service — connection-aware façade + SocialPost helpers.
 * OAuth token exchange and Meta publishing stay in Base44 functions; this module never sees secrets.
 */

import { db, ensureClientSessionToken } from "@/api/base44Client";
import { getSessionAccessToken } from "@/lib/app-params";
import { SOCIAL_PROVIDERS, getSocialProviderConfig } from "@/services/social/providers";
import { CONNECTION_STATUS, CONNECTION_STATUS_META } from "@/services/social/provider";

/**
 * Invoke a Base44 backend function with the active user session.
 * Always forwards cookies (credentials: "include") and Authorization: Bearer when a token exists.
 */
async function invoke(name, payload) {
  const token = ensureClientSessionToken() || getSessionAccessToken();
  const body = payload || {};

  // Prefer low-level fetch so we can set credentials + Bearer explicitly (platform 403 fix).
  if (typeof db?.functions?.fetch === "function") {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await db.functions.fetch(`/${name}`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ...(data && typeof data === "object" ? data : {}),
        ok: false,
        error:
          (data && data.error) ||
          (data && data.message) ||
          `Request failed (${response.status})`,
        _httpStatus: response.status,
      };
    }
    return data?.data ?? data;
  }

  // Fallback: SDK invoke (attaches auth when client token is set).
  const res = await db.functions.invoke(name, body);
  return res?.data ?? res;
}

export function getProviders() {
  return SOCIAL_PROVIDERS.map((cfg) => ({
    ...cfg,
    status: cfg.available ? CONNECTION_STATUS.NOT_CONNECTED : CONNECTION_STATUS.UNAVAILABLE,
    statusMeta: CONNECTION_STATUS_META[
      cfg.available ? CONNECTION_STATUS.NOT_CONNECTED : CONNECTION_STATUS.UNAVAILABLE
    ],
  }));
}

export function getProvider(id) {
  const cfg = getSocialProviderConfig(id);
  if (!cfg) return null;
  return {
    ...cfg,
    status: cfg.available ? CONNECTION_STATUS.NOT_CONNECTED : CONNECTION_STATUS.UNAVAILABLE,
    statusMeta: CONNECTION_STATUS_META[
      cfg.available ? CONNECTION_STATUS.NOT_CONNECTED : CONNECTION_STATUS.UNAVAILABLE
    ],
  };
}

export async function getConnectionStatus() {
  return invoke("socialConnectionStatus", {});
}

/**
 * Start OAuth for a provider. Returns { authorizationUrl } — caller navigates.
 * Pass forceReauth when reconnecting so Instagram re-prompts for new scopes.
 */
export async function startOAuth(provider, { forceReauth = false } = {}) {
  return invoke("socialOAuthStart", { provider, forceReauth: Boolean(forceReauth) });
}

export async function disconnectSocial(provider, accountId) {
  return invoke("socialDisconnect", { provider, accountId });
}

export async function createPost(payload) {
  return invoke("socialPostCreate", payload || {});
}

export async function updatePost(payload) {
  return invoke("socialPostUpdate", payload || {});
}

export async function loadPosts(filters = {}) {
  return invoke("socialPostList", filters);
}

export async function loadPost(postId) {
  return invoke("socialPostList", { postId });
}

/** Publish a SocialPost — always sends authenticated session headers. */
export async function publishPost(postId) {
  return invoke("socialPublish", { postId });
}

export async function prepareMedia({ sourceUrl, purpose = "instagram_feed_image" }) {
  return invoke("prepareMedia", { sourceUrl, purpose });
}

export async function getPostStatus(postId) {
  return loadPost(postId);
}

/**
 * Merge static provider config with live connection status (safe metadata only).
 */
export function mergeProvidersWithConnections(connections = [], providersConfigured = {}) {
  const byProvider = {};
  for (const c of connections) {
    if (!byProvider[c.provider]) byProvider[c.provider] = c;
  }

  return SOCIAL_PROVIDERS.map((cfg) => {
    const live = byProvider[cfg.id];
    const oauthReady = cfg.id === "instagram";

    if (live && live.status === "connected") {
      return {
        ...cfg,
        configured: true,
        available: true,
        status: CONNECTION_STATUS.CONNECTED,
        statusMeta: CONNECTION_STATUS_META[CONNECTION_STATUS.CONNECTED],
        connection: live,
        canPublish: live.canPublish === true,
        needsPublishReauth: live.needsPublishReauth === true,
      };
    }

    if (oauthReady) {
      const isConfigured = providersConfigured.instagram === true;
      return {
        ...cfg,
        configured: isConfigured,
        available: isConfigured,
        status: isConfigured ? CONNECTION_STATUS.NOT_CONNECTED : CONNECTION_STATUS.UNAVAILABLE,
        statusMeta: CONNECTION_STATUS_META[
          isConfigured ? CONNECTION_STATUS.NOT_CONNECTED : CONNECTION_STATUS.UNAVAILABLE
        ],
        connection: null,
        canPublish: false,
        needsPublishReauth: false,
      };
    }

    return {
      ...cfg,
      configured: false,
      available: false,
      status: CONNECTION_STATUS.UNAVAILABLE,
      statusMeta: CONNECTION_STATUS_META[CONNECTION_STATUS.UNAVAILABLE],
      connection: null,
      canPublish: false,
      needsPublishReauth: false,
    };
  });
}

export const POST_STATUS = {
  DRAFT: "draft",
  PUBLISHING: "publishing",
  PUBLISHED: "published",
  FAILED: "failed",
};

export function buildComposePath({ campaignId, campaignDayId, releaseId } = {}) {
  const q = new URLSearchParams();
  if (campaignId) q.set("campaign", campaignId);
  if (campaignDayId) q.set("day", campaignDayId);
  if (releaseId) q.set("release", releaseId);
  const qs = q.toString();
  return qs ? `/social/compose?${qs}` : "/social/compose";
}

export { CONNECTION_STATUS, CONNECTION_STATUS_META, SOCIAL_PROVIDERS };
