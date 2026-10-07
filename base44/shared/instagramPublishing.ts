/**
 * Instagram Content Publishing via Instagram Login for Business / graph.instagram.com.
 * Requires: instagram_business_basic + instagram_business_content_publish.
 * Uses the Instagram user id and Instagram User access token (no Facebook Page).
 *
 * Reels: create container (media_type=REELS) → poll status_code → media_publish.
 * Images: create container (image_url) → poll → media_publish.
 * Media URLs must be publicly reachable HTTPS (Meta cURLs them).
 *
 * Auth: Authorization: Bearer <token> on Graph requests (Instagram Login).
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
  metaStatus?: number;
  metaBody?: unknown;
  constructor(
    code: NormalizedPublishError["code"],
    message: string,
    meta?: { status?: number; body?: unknown }
  ) {
    super(message);
    this.name = "InstagramPublishError";
    this.code = code;
    this.metaStatus = meta?.status;
    this.metaBody = meta?.body;
  }
}

export function normalizeInstagramPublishError(err: unknown): NormalizedPublishError {
  if (err instanceof InstagramPublishError) {
    return { code: err.code, message: err.message };
  }
  const msg = String((err as { message?: string })?.message || err || "Unknown error");
  const lower = msg.toLowerCase();
  if (
    lower.includes("permission") ||
    lower.includes("oauth") ||
    lower.includes("#10") ||
    lower.includes("403")
  ) {
    return {
      code: "PERMISSION_DENIED",
      message: "Instagram permission denied. Reconnect Instagram with publishing access.",
    };
  }
  if (lower.includes("rate") || lower.includes("limit") || lower.includes("100 api")) {
    return { code: "RATE_LIMITED", message: "Instagram publishing rate limit reached. Try again later." };
  }
  if (lower.includes("token") || lower.includes("session")) {
    return { code: "INVALID_TOKEN", message: "Instagram session expired. Reconnect your account." };
  }
  if (lower.includes("media") || lower.includes("image") || lower.includes("video") || lower.includes("download")) {
    return {
      code: "INVALID_MEDIA",
      message:
        "Instagram rejected this media. Use a public JPEG URL, or a public HTTPS MP4 for Reels.",
    };
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
 * IMAGE: public HTTPS — PNG/WebP prepared to JPEG before Meta.
 * VIDEO/REELS: require a real public MP4 on the VideoProject.
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
      message: "Instagram publishing requires a public HTTPS media URL.",
    };
  }

  if (mediaType === "IMAGE") {
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

function graphUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${IG_GRAPH}/${IG_API_VERSION}${p}`;
}

function bearerHeaders(accessToken: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  return headers;
}

/**
 * Log the exact Meta Graph error body (esp. 403) with subcode / type / fbtrace.
 * Never logs the access token.
 */
function logMetaGraphFailure(params: {
  step: string;
  status: number;
  body: unknown;
  path?: string;
}): void {
  const err =
    params.body && typeof params.body === "object"
      ? ((params.body as { error?: Record<string, unknown> }).error || params.body)
      : params.body;
  const errObj = err && typeof err === "object" ? (err as Record<string, unknown>) : null;

  console.error("[instagramPublishing] --- META GRAPH ERROR ---");
  console.error(
    "[instagramPublishing]",
    JSON.stringify({
      step: params.step,
      httpStatus: params.status,
      path: params.path || null,
      message: errObj?.message ?? null,
      type: errObj?.type ?? null,
      code: errObj?.code ?? null,
      error_subcode: errObj?.error_subcode ?? null,
      error_user_title: errObj?.error_user_title ?? null,
      error_user_msg: errObj?.error_user_msg ?? null,
      fbtrace_id: errObj?.fbtrace_id ?? null,
      rawBody: params.body,
    })
  );
}

function throwFromMetaResponse(params: {
  step: string;
  status: number;
  body: Record<string, unknown>;
  fallback: string;
  path?: string;
}): never {
  if (params.status === 403 || params.status === 401) {
    logMetaGraphFailure({
      step: params.step,
      status: params.status,
      body: params.body,
      path: params.path,
    });
  } else if (params.body?.error) {
    logMetaGraphFailure({
      step: params.step,
      status: params.status,
      body: params.body,
      path: params.path,
    });
  }

  const errObj = params.body?.error as
    | { message?: string; code?: number; error_subcode?: number; type?: string }
    | undefined;
  const message =
    errObj?.message ||
    (typeof params.body?.error === "string" ? params.body.error : null) ||
    params.fallback;

  const code: NormalizedPublishError["code"] =
    params.status === 403 || params.status === 401
      ? "PERMISSION_DENIED"
      : "PROVIDER_ERROR";

  throw new InstagramPublishError(code, String(message), {
    status: params.status,
    body: params.body,
  });
}

async function igFetch(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<Record<string, unknown>> {
  const url = graphUrl(path);
  const method = (init?.method || "GET").toUpperCase();
  try {
    const res = await fetch(url, {
      ...init,
      method,
      headers: bearerHeaders(accessToken, init?.headers),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.error) {
      throwFromMetaResponse({
        step: `igFetch:${method}`,
        status: res.status,
        body: data,
        fallback: `Instagram API error (${res.status})`,
        path,
      });
    }
    return data;
  } catch (err) {
    if (err instanceof InstagramPublishError) throw err;
    console.error("[instagramPublishing] igFetch network/catch error=", (err as Error)?.message || err);
    throw err;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Create an image media container. */
export async function createImageContainer(params: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption?: string;
}): Promise<string> {
  const path = `/${params.igUserId}/media`;
  const body = new URLSearchParams({
    image_url: params.imageUrl,
  });
  if (params.caption) body.set("caption", params.caption);

  try {
    const res = await fetch(graphUrl(path), {
      method: "POST",
      headers: bearerHeaders(params.accessToken, {
        "Content-Type": "application/x-www-form-urlencoded",
      }),
      body,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || !data.id) {
      throwFromMetaResponse({
        step: "createImageContainer",
        status: res.status,
        body: data,
        fallback: "Failed to create Instagram media container",
        path,
      });
    }
    return String(data.id);
  } catch (err) {
    if (err instanceof InstagramPublishError) {
      if (err.metaStatus === 403) {
        console.error(
          "[instagramPublishing] 403 on createImageContainer — exact Meta body:",
          JSON.stringify(err.metaBody ?? null)
        );
      }
      throw err;
    }
    console.error(
      "[instagramPublishing] createImageContainer catch=",
      (err as Error)?.message || err
    );
    throw err;
  }
}

/**
 * Step 1 — Create a Reels container.
 * POST /{ig-user-id}/media with Authorization: Bearer + media_type=REELS
 */
export async function createVideoContainer(params: {
  igUserId: string;
  accessToken: string;
  videoUrl: string;
  caption?: string;
  mediaType?: "VIDEO" | "REELS";
}): Promise<string> {
  const path = `/${params.igUserId}/media`;
  // Instagram Login Reels publishing: media_type must be explicitly REELS (default).
  const mediaType = params.mediaType === "VIDEO" ? "VIDEO" : "REELS";
  const body = new URLSearchParams({
    video_url: params.videoUrl,
    media_type: mediaType,
  });
  if (params.caption) body.set("caption", params.caption);

  try {
    const res = await fetch(graphUrl(path), {
      method: "POST",
      headers: bearerHeaders(params.accessToken, {
        "Content-Type": "application/x-www-form-urlencoded",
      }),
      body,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || !data.id) {
      throwFromMetaResponse({
        step: "createVideoContainer",
        status: res.status,
        body: data,
        fallback: "Failed to create Instagram Reels container",
        path,
      });
    }
    return String(data.id);
  } catch (err) {
    if (err instanceof InstagramPublishError) {
      if (err.metaStatus === 403) {
        console.error(
          "[instagramPublishing] 403 on createVideoContainer (Reels) — exact Meta body:",
          JSON.stringify(err.metaBody ?? null)
        );
      }
      throw err;
    }
    console.error(
      "[instagramPublishing] createVideoContainer catch=",
      (err as Error)?.message || err
    );
    throw err;
  }
}

/**
 * Step 2 — Poll container until FINISHED, then caller publishes.
 * status_code: EXPIRED | ERROR | FINISHED | IN_PROGRESS | PUBLISHED
 */
export async function waitForContainerReady(params: {
  containerId: string;
  accessToken: string;
  maxAttempts?: number;
  delayMs?: number;
}): Promise<void> {
  const maxAttempts = params.maxAttempts ?? 60;
  const delayMs = params.delayMs ?? 3000;

  for (let i = 0; i < maxAttempts; i++) {
    const data = await igFetch(
      `/${params.containerId}?fields=status_code,status`,
      params.accessToken
    );
    const code = String(data.status_code || "");
    if (code === "FINISHED" || code === "PUBLISHED") return;
    if (code === "ERROR" || code === "EXPIRED") {
      const detail = data.status ? String(data.status) : "Instagram rejected this media during processing.";
      throw new InstagramPublishError("INVALID_MEDIA", detail);
    }
    await sleep(delayMs);
  }
  throw new InstagramPublishError(
    "MEDIA_NOT_READY",
    "Instagram media is still processing. Try again shortly."
  );
}

export async function fetchContainerStatus(params: {
  containerId: string;
  accessToken: string;
}): Promise<{ statusCode: string; id: string; status?: string }> {
  const data = await igFetch(
    `/${params.containerId}?fields=status_code,status,id`,
    params.accessToken
  );
  return {
    statusCode: String(data.status_code || ""),
    id: String(data.id || params.containerId),
    status: data.status != null ? String(data.status) : undefined,
  };
}

/** Step 3 — Publish a finished container via media_publish + creation_id. */
export async function publishMediaContainer(params: {
  igUserId: string;
  accessToken: string;
  creationId: string;
}): Promise<string> {
  const path = `/${params.igUserId}/media_publish`;
  const body = new URLSearchParams({
    creation_id: params.creationId,
  });

  try {
    const res = await fetch(graphUrl(path), {
      method: "POST",
      headers: bearerHeaders(params.accessToken, {
        "Content-Type": "application/x-www-form-urlencoded",
      }),
      body,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || !data.id) {
      throwFromMetaResponse({
        step: "publishMediaContainer",
        status: res.status,
        body: data,
        fallback: "Failed to publish Instagram media",
        path,
      });
    }
    return String(data.id);
  } catch (err) {
    if (err instanceof InstagramPublishError) {
      if (err.metaStatus === 403) {
        console.error(
          "[instagramPublishing] 403 on publishMediaContainer — exact Meta body:",
          JSON.stringify(err.metaBody ?? null)
        );
      }
      throw err;
    }
    console.error(
      "[instagramPublishing] publishMediaContainer catch=",
      (err as Error)?.message || err
    );
    throw err;
  }
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
 * Full publish pipeline for a single image or Reel/video.
 * Never logs access tokens.
 */
export async function publishInstagramMedia(params: {
  igUserId: string;
  accessToken: string;
  mediaUrl: string;
  mediaType: PublishMediaType;
  caption: string;
  /** Resume a prior container instead of creating a duplicate IG post. */
  existingContainerId?: string;
  /** Persist container id as soon as Meta creates it (before publish completes). */
  onContainerCreated?: (containerId: string) => Promise<void>;
}): Promise<{ mediaId: string; permalink: string | null; containerId: string }> {
  try {
    let containerId = String(params.existingContainerId || "").trim();
    if (containerId) {
      const st = await fetchContainerStatus({ containerId, accessToken: params.accessToken });
      if (st.statusCode === "PUBLISHED") {
        const mediaId = st.id;
        const permalink = await fetchMediaPermalink({
          mediaId,
          accessToken: params.accessToken,
        });
        return { mediaId, permalink, containerId };
      }
    }

    if (!containerId) {
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
          mediaType: "REELS",
        });
      }
      if (params.onContainerCreated) {
        await params.onContainerCreated(containerId);
      }
    }

    await waitForContainerReady({
      containerId,
      accessToken: params.accessToken,
    });

    const afterReady = await fetchContainerStatus({ containerId, accessToken: params.accessToken });
    let mediaId: string;
    if (afterReady.statusCode === "PUBLISHED") {
      mediaId = afterReady.id;
    } else {
      mediaId = await publishMediaContainer({
        igUserId: params.igUserId,
        accessToken: params.accessToken,
        creationId: containerId,
      });
    }

    const permalink = await fetchMediaPermalink({
      mediaId,
      accessToken: params.accessToken,
    });

    return { mediaId, permalink, containerId };
  } catch (err) {
    if (err instanceof InstagramPublishError && err.metaStatus === 403) {
      console.error(
        "[instagramPublishing] publishInstagramMedia 403 — exact Meta body response:",
        JSON.stringify(err.metaBody ?? { message: err.message, code: err.code })
      );
    } else {
      console.error(
        "[instagramPublishing] publishInstagramMedia catch=",
        err instanceof InstagramPublishError
          ? JSON.stringify({
              code: err.code,
              message: err.message,
              metaStatus: err.metaStatus ?? null,
              metaBody: err.metaBody ?? null,
            })
          : String((err as Error)?.message || err)
      );
    }
    throw err;
  }
}
