/**
 * Instagram Content Publishing helpers (Instagram Login / graph.instagram.com).
 * Official guide: Instagram API with Instagram Login — Content Publishing.
 * Requires scopes: instagram_business_basic + instagram_business_content_publish.
 *
 * Media must be on a publicly reachable HTTPS URL (Meta cURLs it).
 * Images: JPEG only per Meta docs.
 */

export const IG_GRAPH = "https://graph.instagram.com";
export const IG_API_VERSION = "v21.0";

/** Instagram caption hard limit (characters). */
export const INSTAGRAM_CAPTION_MAX = 2200;

export type PublishMediaType = "IMAGE" | "VIDEO" | "REELS";

export type NormalizedPublishError = {
  code:
    | "INVALID_TOKEN"
    | "PERMISSION_DENIED"
    | "INVALID_MEDIA"
    | "MEDIA_NOT_READY"
    | "RATE_LIMITED"
    | "DUPLICATE"
    | "PROVIDER_ERROR"
    | "NOT_CONFIGURED"
    | "VALIDATION";
  message: string;
};

export class InstagramPublishError extends Error {
  code: NormalizedPublishError["code"];
  constructor(code: NormalizedPublishError["code"], message: string) {
    super(message);
    this.name = "InstagramPublishError";
    this.code = code;
  }
}

export function normalizeInstagramPublishError(err: unknown): NormalizedPublishError {
  if (err instanceof InstagramPublishError) {
    return { code: err.code, message: err.message };
  }
  const msg = String((err as { message?: string })?.message || err || "Unknown error");
  const lower = msg.toLowerCase();
  if (lower.includes("permission") || lower.includes("oauth") || lower.includes("#10")) {
    return { code: "PERMISSION_DENIED", message: "Instagram permission denied. Reconnect Instagram with publishing access." };
  }
  if (lower.includes("rate") || lower.includes("limit") || lower.includes("100 api")) {
    return { code: "RATE_LIMITED", message: "Instagram publishing rate limit reached. Try again later." };
  }
  if (lower.includes("token") || lower.includes("session")) {
    return { code: "INVALID_TOKEN", message: "Instagram session expired. Reconnect your account." };
  }
  if (lower.includes("media") || lower.includes("image") || lower.includes("video") || lower.includes("download")) {
    return { code: "INVALID_MEDIA", message: "Instagram rejected this media. Use a public JPEG URL (or a real MP4 when video rendering is available)." };
  }
  return { code: "PROVIDER_ERROR", message: "Instagram publishing failed. Try again." };
}

/** Validate caption length; returns trimmed caption or throws. */
export function validateCaption(caption: string | null | undefined): string {
  const text = String(caption || "").trim();
  if (text.length > INSTAGRAM_CAPTION_MAX) {
    throw new InstagramPublishError(
      "VALIDATION",
      `Caption exceeds Instagram's ${INSTAGRAM_CAPTION_MAX} character limit.`
    );
  }
  return text;
}

export function isPublicHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Instagram documents JPEG as the only supported image format. */
export function looksLikeJpegUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".jpg") || path.endsWith(".jpeg") || path.includes(".jpg?") || path.includes(".jpeg?");
  } catch {
    return false;
  }
}

export function looksLikeVideoUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return [".mp4", ".mov", ".m4v"].some((ext) => path.endsWith(ext));
  } catch {
    return false;
  }
}

/**
 * Assess whether source media can enter the Instagram publish path.
 * IMAGE: public HTTPS JPEG/PNG/WebP — PNG/WebP are prepared to JPEG before Meta.
 * VIDEO/REELS: still require a real public MP4 (not implemented in renderer yet).
 */
export function assessMediaPublishability(params: {
  mediaUrl?: string | null;
  mediaType?: string | null;
  videoProject?: {
    rendering_status?: string;
    render_output_url?: string | null;
    is_demo?: boolean;
  } | null;
}): { ok: boolean; code?: NormalizedPublishError["code"]; message?: string; needsPreparation?: boolean } {
  const mediaType = String(params.mediaType || "IMAGE").toUpperCase();
  const url = String(params.mediaUrl || "").trim();

  if (!url) {
    return { ok: false, code: "INVALID_MEDIA", message: "Select an artwork before publishing." };
  }
  if (!isPublicHttpsUrl(url)) {
    return {
      ok: false,
      code: "INVALID_MEDIA",
      message: "Instagram publishing requires a public HTTPS image.",
    };
  }

  if (mediaType === "IMAGE") {
    // Allow JPEG/PNG/WebP (and extension-less CDN URLs). Preparation verifies magic bytes.
    const needsPreparation = !looksLikeJpegUrl(url);
    return { ok: true, needsPreparation };
  }

  if (mediaType === "VIDEO" || mediaType === "REELS") {
    const vp = params.videoProject;
    if (!vp || vp.rendering_status !== "complete" || !vp.render_output_url) {
      return {
        ok: false,
        code: "MEDIA_NOT_READY",
        message: "Video rendering is not available yet. Export a real MP4 before publishing Reels.",
      };
    }
    if (!looksLikeVideoUrl(vp.render_output_url) || !isPublicHttpsUrl(vp.render_output_url)) {
      return {
        ok: false,
        code: "MEDIA_NOT_READY",
        message: "Video rendering is not available yet. No public MP4 URL is available for this project.",
      };
    }
    if (url !== vp.render_output_url) {
      return {
        ok: false,
        code: "INVALID_MEDIA",
        message: "Video media URL must match the rendered VideoProject output.",
      };
    }
    return { ok: true, needsPreparation: false };
  }

  return { ok: false, code: "INVALID_MEDIA", message: "Unsupported media type for Instagram publishing." };
}

async function igFetch(path: string, accessToken: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const url = path.startsWith("http") ? path : `${IG_GRAPH}/${IG_API_VERSION}${path}`;
  const sep = url.includes("?") ? "&" : "?";
  const withToken = `${url}${sep}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(withToken, init);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.error) {
    const errObj = data.error as { message?: string; code?: number } | undefined;
    const message = errObj?.message || `Instagram API error (${res.status})`;
    throw new InstagramPublishError("PROVIDER_ERROR", message);
  }
  return data;
}

/** Create an image media container. */
export async function createImageContainer(params: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption?: string;
}): Promise<string> {
  const body = new URLSearchParams({
    image_url: params.imageUrl,
    access_token: params.accessToken,
  });
  if (params.caption) body.set("caption", params.caption);

  const res = await fetch(`${IG_GRAPH}/${IG_API_VERSION}/${params.igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    const message = data?.error?.message || "Failed to create Instagram media container";
    throw new InstagramPublishError("PROVIDER_ERROR", message);
  }
  return String(data.id);
}

/** Create a video/reels container (requires public video_url). */
export async function createVideoContainer(params: {
  igUserId: string;
  accessToken: string;
  videoUrl: string;
  caption?: string;
  mediaType?: "VIDEO" | "REELS";
}): Promise<string> {
  const body = new URLSearchParams({
    video_url: params.videoUrl,
    media_type: params.mediaType || "REELS",
    access_token: params.accessToken,
  });
  if (params.caption) body.set("caption", params.caption);

  const res = await fetch(`${IG_GRAPH}/${IG_API_VERSION}/${params.igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    const message = data?.error?.message || "Failed to create Instagram video container";
    throw new InstagramPublishError("PROVIDER_ERROR", message);
  }
  return String(data.id);
}

/**
 * Poll container status until FINISHED / ERROR / timeout.
 * status_code values: EXPIRED, ERROR, FINISHED, IN_PROGRESS, PUBLISHED
 */
export async function waitForContainerReady(params: {
  containerId: string;
  accessToken: string;
  maxAttempts?: number;
  delayMs?: number;
}): Promise<void> {
  const maxAttempts = params.maxAttempts ?? 30;
  const delayMs = params.delayMs ?? 2000;

  for (let i = 0; i < maxAttempts; i++) {
    const data = await igFetch(`/${params.containerId}?fields=status_code`, params.accessToken);
    const code = String(data.status_code || "");
    if (code === "FINISHED" || code === "PUBLISHED") return;
    if (code === "ERROR" || code === "EXPIRED") {
      throw new InstagramPublishError("INVALID_MEDIA", "Instagram rejected this media during processing.");
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new InstagramPublishError("MEDIA_NOT_READY", "Instagram media is still processing. Try again shortly.");
}

/** Publish a finished media container. */
export async function publishMediaContainer(params: {
  igUserId: string;
  accessToken: string;
  creationId: string;
}): Promise<string> {
  const body = new URLSearchParams({
    creation_id: params.creationId,
    access_token: params.accessToken,
  });
  const res = await fetch(`${IG_GRAPH}/${IG_API_VERSION}/${params.igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    const message = data?.error?.message || "Failed to publish Instagram media";
    throw new InstagramPublishError("PROVIDER_ERROR", message);
  }
  return String(data.id);
}

/** Fetch permalink for a published media id (best-effort). */
export async function fetchMediaPermalink(params: {
  mediaId: string;
  accessToken: string;
}): Promise<string | null> {
  try {
    const data = await igFetch(`/${params.mediaId}?fields=permalink,id`, params.accessToken);
    return data.permalink ? String(data.permalink) : null;
  } catch {
    return null;
  }
}

/**
 * Full publish pipeline for a single image or video.
 * Never logs access tokens.
 */
export async function publishInstagramMedia(params: {
  igUserId: string;
  accessToken: string;
  mediaUrl: string;
  mediaType: PublishMediaType;
  caption: string;
}): Promise<{ mediaId: string; permalink: string | null; containerId: string }> {
  let containerId: string;
  if (params.mediaType === "IMAGE") {
    containerId = await createImageContainer({
      igUserId: params.igUserId,
      accessToken: params.accessToken,
      imageUrl: params.mediaUrl,
      caption: params.caption,
    });
  } else {
    containerId = await createVideoContainer({
      igUserId: params.igUserId,
      accessToken: params.accessToken,
      videoUrl: params.mediaUrl,
      caption: params.caption,
      mediaType: params.mediaType === "VIDEO" ? "VIDEO" : "REELS",
    });
  }

  await waitForContainerReady({
    containerId,
    accessToken: params.accessToken,
  });

  const mediaId = await publishMediaContainer({
    igUserId: params.igUserId,
    accessToken: params.accessToken,
    creationId: containerId,
  });

  const permalink = await fetchMediaPermalink({
    mediaId,
    accessToken: params.accessToken,
  });

  return { mediaId, permalink, containerId };
}
