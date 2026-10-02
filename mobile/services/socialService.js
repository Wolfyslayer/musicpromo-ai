/**
 * Social Hub service — connection-aware façade + SocialPost helpers.
 * OAuth token exchange and Meta publishing stay in Base44 functions; this module never sees secrets.
 */

import { db, ensureClientSessionToken } from "@/api/db";
import { getSessionAccessToken } from "@/lib/app-params";
import { SOCIAL_PROVIDERS, getSocialProviderConfig } from "@/services/social/providers";
import { CONNECTION_STATUS, CONNECTION_STATUS_META } from "@/services/social/provider";

const OAUTH_PROVIDERS = new Set(["instagram", "tiktok", "youtube"]);

/**
 * Invoke a Base44 backend function with the active user session.
 *
 * Use SDK `functions.invoke` (Bearer via client token) — do NOT set
 * credentials: "include". Cross-origin calls to base44.app return
 * Access-Control-Allow-Origin: *, which browsers reject with credentialed fetch.
 */
function unwrapInvokeResult(res) {
  // SDK may return the JSON body directly or an axios-like { data }.
  let payload = res?.data ?? res;
  // Rare double-wrap: { data: { data: {...} } }
  if (
    payload &&
    typeof payload === "object" &&
    payload.data &&
    typeof payload.data === "object" &&
    (payload.data.providersConfigured != null || payload.data.connections != null)
  ) {
    payload = payload.data;
  }
  return payload;
}

function errorFromInvoke(err) {
  const status = err?.status || err?.response?.status || null;
  const data = err?.data || err?.response?.data || {};
  return {
    ...(data && typeof data === "object" ? data : {}),
    ok: false,
    error:
      (data && data.error) ||
      (data && data.message) ||
      err?.message ||
      (status ? `Request failed (${status})` : "Request failed"),
    _httpStatus: status,
  };
}

async function invoke(name, payload) {
  ensureClientSessionToken() || getSessionAccessToken();
  const body = payload || {};

  try {
    const res = await db.functions.invoke(name, body);
    return unwrapInvokeResult(res);
  } catch (err) {
    return errorFromInvoke(err);
  }
}

function initialProviderStatus(cfg) {
  // oauthImplemented platforms are connectable; only wait on live
  // providersConfigured for soft hints, never for hard-disabling Connect.
  if (cfg.oauthImplemented === true) {
    return CONNECTION_STATUS.NOT_CONNECTED;
  }
  return CONNECTION_STATUS.UNAVAILABLE;
}

export function getProviders() {
  return SOCIAL_PROVIDERS.map((cfg) => {
    const status = initialProviderStatus(cfg);
    return {
      ...cfg,
      available: cfg.oauthImplemented === true,
      status,
      statusMeta: CONNECTION_STATUS_META[status],
    };
  });
}

export function getProvider(id) {
  const cfg = getSocialProviderConfig(id);
  if (!cfg) return null;
  const status = initialProviderStatus(cfg);
  return {
    ...cfg,
    available: cfg.oauthImplemented === true,
    status,
    statusMeta: CONNECTION_STATUS_META[status],
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
  const id = String(
    typeof provider === "object" && provider
      ? provider.id || provider.provider || ""
      : provider || ""
  )
    .trim()
    .toLowerCase();

  if (!OAUTH_PROVIDERS.has(id)) {
    return {
      ok: false,
      error: `Invalid provider "${id || "(empty)"}". Use instagram, tiktok, or youtube.`,
      code: "VALIDATION",
      provider: id,
      supported: [...OAUTH_PROVIDERS],
    };
  }

  // Use connectSocialProvider (not socialOAuthStart): the old name is intercepted
  // by a Base44 platform handler that returns "This provider is not available…"
  // for tiktok/youtube without executing our function code.
  return invoke("connectSocialProvider", {
    provider: id,
    forceReauth: Boolean(forceReauth),
  });
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

export async function publishPost(postId) {
  return invoke("socialPublish", { postId });
}

/**
 * Schedule a campaign day for social publish.
 * @param {{ campaignId: string, dayId?: string, renderImmediately?: boolean }} payload
 */
export async function scheduleCampaignDay(payload) {
  return invoke("campaignSchedule", payload || {});
}

/**
 * Attach a client-rendered 9:16 promo MP4 to a campaign.
 * @param {{ campaignId: string, videoUrl: string }} payload
 */
export async function triggerCampaignAutoVideo(payload) {
  return invoke("campaignAutoVideo", payload || {});
}

/** Sync platform stats (views/likes/comments/shares) into AnalyticsEntry. */
export async function syncSocialStats(socialAccountId) {
  return invoke("socialStatsSync", socialAccountId ? { socialAccountId } : {});
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
    const oauthReady = cfg.oauthImplemented === true;

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
      // Never hard-block Connect for oauthImplemented platforms.
      // Only treat configured as false when the server returned an explicit map.
      const hasConfigMap =
        providersConfigured &&
        typeof providersConfigured === "object" &&
        Object.keys(providersConfigured).length > 0;
      const isConfigured = hasConfigMap ? providersConfigured[cfg.id] === true : null;
      return {
        ...cfg,
        configured: isConfigured,
        available: true,
        status: CONNECTION_STATUS.NOT_CONNECTED,
        statusMeta: CONNECTION_STATUS_META[CONNECTION_STATUS.NOT_CONNECTED],
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
  SCHEDULED: "scheduled",
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
  return qs ? `/social/compose?${qs}` : `/social/compose`;
}

export { CONNECTION_STATUS, CONNECTION_STATUS_META, SOCIAL_PROVIDERS };
