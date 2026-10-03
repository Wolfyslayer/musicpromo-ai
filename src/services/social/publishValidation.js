/**
 * Pure helpers for SocialPost draft vs Instagram publish validation (frontend-safe).
 * Draft rules are minimal. PNG/WebP are allowed for drafts and auto-prepared on publish.
 * No secrets. No network.
 */

export const INSTAGRAM_CAPTION_MAX = 2200;

export function isPublicHttpsUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export function looksLikeJpegUrl(url) {
  if (!url) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".jpg") || path.endsWith(".jpeg");
  } catch {
    return /\.jpe?g(\?|$)/i.test(String(url));
  }
}

export function looksLikePngOrWebpUrl(url) {
  if (!url) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".png") || path.endsWith(".webp");
  } catch {
    return /\.(png|webp)(\?|$)/i.test(String(url));
  }
}

export function isPreparableImageUrl(url) {
  return Boolean(url && isPublicHttpsUrl(url));
}

export function canRetryPublish(status) {
  return status === "failed";
}

export function canStartPublish(status, externalPostId) {
  if (externalPostId) return false;
  if (status === "published" || status === "publishing" || status === "scheduled") return false;
  return status === "draft" || status === "failed";
}

export function validateCaptionLength(caption) {
  const text = String(caption || "");
  if (text.length > INSTAGRAM_CAPTION_MAX) {
    return { ok: false, code: "VALIDATION", message: `Caption exceeds ${INSTAGRAM_CAPTION_MAX} characters.` };
  }
  return { ok: true };
}

/** Draft saves only need caption length within Instagram's hard limit (empty OK). */
export function validateDraftFields({ caption } = {}) {
  return validateCaptionLength(caption);
}

/**
 * Informational note when artwork will be auto-prepared (not an error).
 */
export function getMediaPreparationHint(mediaUrl, mediaType = "IMAGE") {
  if (String(mediaType || "IMAGE").toUpperCase() !== "IMAGE") return null;
  if (!mediaUrl) return null;
  if (looksLikeJpegUrl(mediaUrl)) return null;
  if (looksLikePngOrWebpUrl(mediaUrl) || isPublicHttpsUrl(mediaUrl)) {
    return "Instagram will automatically prepare this image as a JPEG before publishing.";
  }
  return null;
}

/**
 * Client-side publish blockers (server remains authoritative in socialPublish).
 * Does NOT block PNG/WebP — those are prepared automatically.
 */
export function getInstagramPublishBlocker({
  instagram,
  post,
  mediaUrl,
  mediaType = "IMAGE",
  videoReady = false,
} = {}) {
  if (!instagram) {
    return "Connect Instagram before publishing.";
  }
  if (instagram.needsPublishReauth || instagram.canPublish === false) {
    return "Reconnect Instagram to grant publishing permission.";
  }
  if (!post?.id) {
    return "Save a draft before publishing.";
  }
  if (!canStartPublish(post.status, post.externalPostId)) {
    if (post.status === "published" || post.externalPostId) {
      return "This post is already published.";
    }
    if (post.status === "publishing") {
      return "This post is already publishing.";
    }
    return "This post cannot be published from its current status.";
  }

  const type = String(mediaType || "IMAGE").toUpperCase();
  const url = String(mediaUrl || "").trim();

  if (!url) {
    return "Select an artwork before publishing.";
  }
  if (!isPublicHttpsUrl(url)) {
    return "Instagram publishing requires a public HTTPS image.";
  }

  if (type === "IMAGE") {
    return null;
  }

  if (type === "VIDEO" || type === "REELS") {
    if (!videoReady) {
      return "Video rendering is not available yet. Export a real MP4 before publishing Reels.";
    }
    return null;
  }

  return "Unsupported media type for Instagram publishing.";
}

function baseConnectionBlocker(connection, providerLabel) {
  if (!connection) {
    return `Connect ${providerLabel} before publishing.`;
  }
  if (connection.needsPublishReauth || connection.canPublish === false) {
    return `Reconnect ${providerLabel} to grant publishing permission.`;
  }
  return null;
}

/**
 * Client-side publish guard for manual compose (server remains authoritative).
 */
export function getPublishBlockerForProvider(
  providerId,
  { connection, post, mediaUrl, mediaType = "IMAGE", videoReady = false } = {}
) {
  const provider = String(providerId || "instagram").toLowerCase();
  const label =
    provider === "tiktok"
      ? "TikTok"
      : provider === "youtube"
        ? "YouTube"
        : provider === "x"
          ? "X"
          : "Instagram";

  const connBlock = baseConnectionBlocker(connection, label);
  if (connBlock) return connBlock;

  if (!post?.id) {
    return "Save a draft before publishing.";
  }
  if (!canStartPublish(post.status, post.externalPostId)) {
    if (post.status === "published" || post.externalPostId) {
      return "This post is already published.";
    }
    if (post.status === "publishing") {
      return "This post is already publishing.";
    }
    return "This post cannot be published from its current status.";
  }

  if (provider === "instagram") {
    return getInstagramPublishBlocker({
      instagram: connection,
      post,
      mediaUrl,
      mediaType,
      videoReady,
    });
  }

  const url = String(mediaUrl || "").trim();
  const type = String(mediaType || "IMAGE").toUpperCase();

  if (provider === "tiktok" || provider === "youtube") {
    if (type !== "REELS" && type !== "VIDEO") {
      return `${label} requires a rendered promo video — use "Use rendered video" or create one in Studio.`;
    }
    if (!url || !isPublicHttpsUrl(url)) {
      return `${label} publishing requires a public HTTPS video URL.`;
    }
    if (!videoReady && !/\.(mp4|mov|webm)(\?|$)/i.test(url)) {
      return `Export a complete MP4 for ${label} before publishing.`;
    }
    return null;
  }

  if (provider === "x") {
    if (!url && !String(post.caption || "").trim()) {
      return "Add a caption or media before publishing to X.";
    }
    if (url && !isPublicHttpsUrl(url)) {
      return "X media must use a public HTTPS URL.";
    }
    return null;
  }

  return `Unsupported provider "${provider}".`;
}
