export const INSTAGRAM_CAPTION_MAX = 2200;

export function isPublicHttpsUrl(url?: string) {
  try {
    return new URL(String(url)).protocol === "https:";
  } catch {
    return false;
  }
}

export function looksLikeJpegUrl(url?: string) {
  if (!url) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".jpg") || path.endsWith(".jpeg");
  } catch {
    return /\.jpe?g(\?|$)/i.test(String(url));
  }
}

export function looksLikePngOrWebpUrl(url?: string) {
  if (!url) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".png") || path.endsWith(".webp");
  } catch {
    return /\.(png|webp)(\?|$)/i.test(String(url));
  }
}

export function canStartPublish(status?: string, externalPostId?: string) {
  if (externalPostId) return false;
  if (status === "published" || status === "publishing" || status === "scheduled") return false;
  return status === "draft" || status === "failed";
}

export function validateCaptionLength(caption?: string) {
  const text = String(caption || "");
  if (text.length > INSTAGRAM_CAPTION_MAX) {
    return { ok: false, message: `Caption exceeds ${INSTAGRAM_CAPTION_MAX} characters.` };
  }
  return { ok: true };
}

export function getMediaPreparationHint(mediaUrl?: string, mediaType = "IMAGE") {
  if (String(mediaType || "IMAGE").toUpperCase() !== "IMAGE") return null;
  if (!mediaUrl) return null;
  if (looksLikeJpegUrl(mediaUrl)) return null;
  if (looksLikePngOrWebpUrl(mediaUrl) || isPublicHttpsUrl(mediaUrl)) {
    return "Instagram will automatically prepare this image as a JPEG before publishing.";
  }
  return null;
}

export function getInstagramPublishBlocker({
  instagram,
  post,
  mediaUrl,
  mediaType = "IMAGE",
  videoReady = false,
}: {
  instagram?: { needsPublishReauth?: boolean; canPublish?: boolean } | null;
  post?: { id?: string; status?: string; externalPostId?: string } | null;
  mediaUrl?: string;
  mediaType?: string;
  videoReady?: boolean;
}) {
  if (!instagram) return "Connect Instagram before publishing.";
  if (instagram.needsPublishReauth || instagram.canPublish === false) {
    return "Reconnect Instagram to grant publishing permission.";
  }
  if (!post?.id) return "Save a draft before publishing.";
  if (!canStartPublish(post.status, post.externalPostId)) {
    if (post.status === "published" || post.externalPostId) return "This post is already published.";
    if (post.status === "publishing") return "This post is already publishing.";
    return "This post cannot be published from its current status.";
  }
  const type = String(mediaType || "IMAGE").toUpperCase();
  const url = String(mediaUrl || "").trim();
  if (!url) return "Select an artwork before publishing.";
  if (!isPublicHttpsUrl(url)) return "Instagram publishing requires a public HTTPS image.";
  if (type === "IMAGE") return null;
  if (type === "VIDEO" || type === "REELS") {
    if (!videoReady) return "Video rendering is not available yet. Export a real MP4 before publishing Reels.";
    return null;
  }
  return "Unsupported media type for Instagram publishing.";
}
