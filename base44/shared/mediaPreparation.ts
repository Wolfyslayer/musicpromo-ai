/**
 * Reusable media preparation types for social publishing.
 * Image JPEG preparation is implemented; video preparation is reserved for later phases.
 */

export type MediaKind = "image" | "video" | "audio";

export type SourceFormat =
  | "jpg"
  | "jpeg"
  | "png"
  | "webp"
  | "mp4"
  | "unknown";

export type PreparedFormat = "jpeg" | "mp4" | "original";

export type PreparationPurpose =
  | "instagram_feed_image"
  | "instagram_reel"
  | "generic_social_image";

export type PreparedMediaStatus = "pending" | "ready" | "failed";

export type MediaPreparationErrorCode =
  | "MEDIA_SOURCE_MISSING"
  | "MEDIA_FETCH_FAILED"
  | "MEDIA_NOT_AN_IMAGE"
  | "MEDIA_FORMAT_UNSUPPORTED"
  | "MEDIA_CONVERSION_FAILED"
  | "MEDIA_UPLOAD_FAILED"
  | "MEDIA_PUBLIC_URL_REQUIRED"
  | "MEDIA_PREPARATION_FAILED"
  | "MEDIA_PURPOSE_UNSUPPORTED";

export type MediaRequirement = {
  purpose: PreparationPurpose;
  mediaType: MediaKind;
  acceptedOutput: PreparedFormat;
  requiresPublicHttps: boolean;
  /** True when this purpose is implemented in the current phase. */
  implemented: boolean;
};

/** Provider requirement catalog — only instagram_feed_image is active. */
export const MEDIA_REQUIREMENTS: Record<PreparationPurpose, MediaRequirement> = {
  instagram_feed_image: {
    purpose: "instagram_feed_image",
    mediaType: "image",
    acceptedOutput: "jpeg",
    requiresPublicHttps: true,
    implemented: true,
  },
  instagram_reel: {
    purpose: "instagram_reel",
    mediaType: "video",
    acceptedOutput: "mp4",
    requiresPublicHttps: true,
    implemented: false,
  },
  generic_social_image: {
    purpose: "generic_social_image",
    mediaType: "image",
    acceptedOutput: "jpeg",
    requiresPublicHttps: true,
    implemented: true,
  },
};

/** JPEG quality for prepared social images (85–92 band). */
export const PREPARED_JPEG_QUALITY = 90;

/** White background for compositing transparent PNG/WebP before JPEG. */
export const TRANSPARENT_COMPOSITE_BG = 0xffffffff;

export class MediaPreparationError extends Error {
  code: MediaPreparationErrorCode;
  constructor(code: MediaPreparationErrorCode, message: string) {
    super(message);
    this.name = "MediaPreparationError";
    this.code = code;
  }
}

export function isPublicHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Detect image/video format from magic bytes (do not trust filenames alone). */
export function detectFormatFromBytes(bytes: Uint8Array): SourceFormat {
  if (bytes.length < 12) return "unknown";
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  // PNG
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  // WEBP: RIFF....WEBP
  const riff =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46;
  const webp =
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (riff && webp) return "webp";
  // MP4 / ISO BMFF often has "ftyp" at offset 4
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return "mp4";
  }
  return "unknown";
}

export function looksLikeConvertibleImageUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(jpe?g|png|webp)(\?|$)/i.test(path) || path.includes(".jpg") || path.includes(".jpeg") || path.includes(".png") || path.includes(".webp");
  } catch {
    return /\.(jpe?g|png|webp)(\?|$)/i.test(String(url));
  }
}

export function isJpegSourceFormat(fmt: SourceFormat): boolean {
  return fmt === "jpeg" || fmt === "jpg";
}

export function isConvertibleImageFormat(fmt: SourceFormat): boolean {
  return fmt === "jpeg" || fmt === "jpg" || fmt === "png" || fmt === "webp";
}

/**
 * Download a remote media URL server-side.
 * Never logs response bodies that might contain credentials.
 */
export async function fetchSourceBytes(sourceUrl: string): Promise<{
  bytes: Uint8Array;
  contentType: string | null;
}> {
  if (!sourceUrl?.trim()) {
    throw new MediaPreparationError("MEDIA_SOURCE_MISSING", "Select artwork before preparing media.");
  }
  if (!isPublicHttpsUrl(sourceUrl)) {
    throw new MediaPreparationError(
      "MEDIA_PUBLIC_URL_REQUIRED",
      "Source media must be a public HTTPS URL."
    );
  }

  let res: Response;
  try {
    res = await fetch(sourceUrl, { redirect: "follow" });
  } catch {
    throw new MediaPreparationError("MEDIA_FETCH_FAILED", "Could not download the source media.");
  }
  if (!res.ok) {
    throw new MediaPreparationError("MEDIA_FETCH_FAILED", "Could not download the source media.");
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  if (!buf.byteLength) {
    throw new MediaPreparationError("MEDIA_FETCH_FAILED", "Source media download was empty.");
  }
  // Soft size guard (~25MB) to avoid runaway memory in functions
  if (buf.byteLength > 25 * 1024 * 1024) {
    throw new MediaPreparationError("MEDIA_FORMAT_UNSUPPORTED", "Source media is too large to prepare.");
  }

  return {
    bytes: buf,
    contentType: res.headers.get("content-type"),
  };
}

/**
 * Convert image bytes to JPEG using pure-JS codecs only (jpeg-js + pngjs).
 * No native .node binaries — required for Base44 Deno function bundling.
 * Transparent PNG pixels are composited onto white before encoding.
 * WebP uses WebCodecs ImageDecoder when the runtime provides it.
 */
export async function convertImageBytesToJpeg(
  bytes: Uint8Array,
  sourceFormat: SourceFormat
): Promise<{ jpegBytes: Uint8Array; width: number; height: number }> {
  if (!isConvertibleImageFormat(sourceFormat)) {
    throw new MediaPreparationError(
      "MEDIA_FORMAT_UNSUPPORTED",
      "Only JPEG, PNG, and WebP images can be prepared for Instagram."
    );
  }

  try {
    let width = 0;
    let height = 0;
    let rgba: Uint8Array;

    if (sourceFormat === "jpeg" || sourceFormat === "jpg") {
      const jpegJs = await import("npm:jpeg-js@0.4.4");
      const decoded = jpegJs.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 64 });
      width = decoded.width;
      height = decoded.height;
      rgba = decoded.data as Uint8Array;
    } else if (sourceFormat === "png") {
      const { PNG } = await import("npm:pngjs@7.0.0");
      const png = PNG.sync.read(bytes);
      width = png.width;
      height = png.height;
      rgba = compositeRgbaOntoWhite(png.data as Uint8Array);
    } else if (sourceFormat === "webp") {
      const decoded = await decodeWebpToRgba(bytes);
      width = decoded.width;
      height = decoded.height;
      rgba = compositeRgbaOntoWhite(decoded.rgba);
    } else {
      throw new MediaPreparationError(
        "MEDIA_FORMAT_UNSUPPORTED",
        "Only JPEG, PNG, and WebP images can be prepared for Instagram."
      );
    }

    const jpegJs = await import("npm:jpeg-js@0.4.4");
    const encoded = jpegJs.encode({ data: rgba, width, height }, PREPARED_JPEG_QUALITY);
    return { jpegBytes: new Uint8Array(encoded.data), width, height };
  } catch (err) {
    if (err instanceof MediaPreparationError) throw err;
    const msg = String((err as { message?: string })?.message || "");
    if (msg.toLowerCase().includes("decode") || msg.toLowerCase().includes("unsupported")) {
      throw new MediaPreparationError("MEDIA_NOT_AN_IMAGE", "Source file is not a supported image.");
    }
    throw new MediaPreparationError(
      "MEDIA_CONVERSION_FAILED",
      "Could not convert artwork to JPEG."
    );
  }
}

/** Premultiply-style composite of RGBA onto opaque white (JPEG has no alpha). */
function compositeRgbaOntoWhite(src: Uint8Array): Uint8Array {
  const out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3]! / 255;
    const inv = 1 - a;
    out[i] = Math.round(src[i]! * a + 255 * inv);
    out[i + 1] = Math.round(src[i + 1]! * a + 255 * inv);
    out[i + 2] = Math.round(src[i + 2]! * a + 255 * inv);
    out[i + 3] = 255;
  }
  return out;
}

/**
 * Decode WebP without npm native codecs.
 * Prefers WebCodecs ImageDecoder when present in the Deno runtime.
 */
async function decodeWebpToRgba(
  bytes: Uint8Array
): Promise<{ width: number; height: number; rgba: Uint8Array }> {
  // deno-lint-ignore no-explicit-any
  const ImageDecoderCtor = (globalThis as any).ImageDecoder;
  if (typeof ImageDecoderCtor === "function") {
    try {
      const decoder = new ImageDecoderCtor({
        data: bytes,
        type: "image/webp",
      });
      const { image } = await decoder.decode({ frameIndex: 0 });
      const width = image.displayWidth || image.codedWidth;
      const height = image.displayHeight || image.codedHeight;
      const buffer = new ArrayBuffer(width * height * 4);
      const opts = { format: "RGBA", size: { height, width } };
      await image.copyTo(buffer, opts);
      image.close?.();
      decoder.close?.();
      return { width, height, rgba: new Uint8Array(buffer) };
    } catch {
      /* fall through */
    }
  }

  throw new MediaPreparationError(
    "MEDIA_FORMAT_UNSUPPORTED",
    "WebP conversion is not available in this runtime. Re-upload artwork as PNG or JPEG."
  );
}

export type PreparedMediaResult = {
  id: string;
  sourceUrl: string;
  sourceFormat: SourceFormat;
  preparedUrl: string;
  preparedFormat: PreparedFormat;
  purpose: PreparationPurpose;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  status: PreparedMediaStatus;
  reused: boolean;
};

/**
 * Upload JPEG bytes via Base44 public file integration.
 * Prefers UploadPublicFile (frontend pattern) then UploadFile (SDK docs).
 */
export async function uploadPreparedJpeg(
  // deno-lint-ignore no-explicit-any
  base44: any,
  jpegBytes: Uint8Array,
  filename = "instagram-prepared.jpg"
): Promise<string> {
  const file = new File([jpegBytes], filename, { type: "image/jpeg" });
  const core = base44.asServiceRole.integrations.Core;

  try {
    if (typeof core.UploadPublicFile === "function") {
      const res = await core.UploadPublicFile({ file });
      const url = res?.file_url || res?.url;
      if (url && isPublicHttpsUrl(String(url))) return String(url);
    }
  } catch {
    /* fall through to UploadFile */
  }

  try {
    const res = await core.UploadFile({ file });
    const url = res?.file_url || res?.url;
    if (url && isPublicHttpsUrl(String(url))) return String(url);
    throw new Error("missing public url");
  } catch {
    throw new MediaPreparationError(
      "MEDIA_UPLOAD_FAILED",
      "Could not store the prepared JPEG in public storage."
    );
  }
}

/**
 * Prepare Instagram feed image: reuse existing PreparedMedia when possible,
 * otherwise convert to public HTTPS JPEG and persist a PreparedMedia row.
 */
export async function prepareInstagramFeedImage(params: {
  // deno-lint-ignore no-explicit-any
  base44: any;
  userId: string;
  sourceUrl: string;
  purpose?: PreparationPurpose;
}): Promise<PreparedMediaResult> {
  const purpose: PreparationPurpose = params.purpose || "instagram_feed_image";
  const requirement = MEDIA_REQUIREMENTS[purpose];
  if (!requirement?.implemented || requirement.mediaType !== "image") {
    throw new MediaPreparationError(
      "MEDIA_PURPOSE_UNSUPPORTED",
      "This media preparation purpose is not available yet."
    );
  }

  const sourceUrl = String(params.sourceUrl || "").trim();
  if (!sourceUrl) {
    throw new MediaPreparationError("MEDIA_SOURCE_MISSING", "Select artwork before preparing media.");
  }
  if (!isPublicHttpsUrl(sourceUrl)) {
    throw new MediaPreparationError(
      "MEDIA_PUBLIC_URL_REQUIRED",
      "Source media must be a public HTTPS URL."
    );
  }

  // Deduplicate successful preparations for the same source + purpose + user
  const existing = await params.base44.asServiceRole.entities.PreparedMedia.filter(
    {
      user_id: params.userId,
      source_url: sourceUrl,
      purpose,
      status: "ready",
    },
    "-created_date",
    5
  ).catch(() => []);

  const hit = (existing || []).find(
    (r: { prepared_url?: string; prepared_format?: string }) =>
      r.prepared_url && r.prepared_format === "jpeg" && isPublicHttpsUrl(String(r.prepared_url))
  );
  if (hit) {
    console.log("[mediaPreparation] reuse", purpose, hit.source_format || "unknown");
    return {
      id: String(hit.id),
      sourceUrl,
      sourceFormat: (hit.source_format || "unknown") as SourceFormat,
      preparedUrl: String(hit.prepared_url),
      preparedFormat: "jpeg",
      purpose,
      width: hit.width ?? null,
      height: hit.height ?? null,
      fileSize: hit.file_size ?? null,
      status: "ready",
      reused: true,
    };
  }

  const pending = await params.base44.asServiceRole.entities.PreparedMedia.create({
    user_id: params.userId,
    source_url: sourceUrl,
    source_filename: "",
    source_format: "unknown",
    media_type: "image",
    purpose,
    prepared_url: "",
    prepared_format: "jpeg",
    width: 0,
    height: 0,
    file_size: 0,
    status: "pending",
    error_code: "",
    error_message: "",
  });

  try {
    const { bytes } = await fetchSourceBytes(sourceUrl);
    const detected = detectFormatFromBytes(bytes);
    if (!isConvertibleImageFormat(detected)) {
      throw new MediaPreparationError(
        "MEDIA_NOT_AN_IMAGE",
        "Source file is not a supported image (JPEG, PNG, or WebP)."
      );
    }

    let jpegBytes: Uint8Array;
    let width: number;
    let height: number;

    if (isJpegSourceFormat(detected)) {
      // Re-encode JPEG for consistency / strip exotic encodings; still a JPEG derivative.
      const converted = await convertImageBytesToJpeg(bytes, detected);
      jpegBytes = converted.jpegBytes;
      width = converted.width;
      height = converted.height;
    } else {
      const converted = await convertImageBytesToJpeg(bytes, detected);
      jpegBytes = converted.jpegBytes;
      width = converted.width;
      height = converted.height;
    }

    console.log("[mediaPreparation] convert", purpose, detected, "->", "jpeg", width, "x", height);

    const preparedUrl = await uploadPreparedJpeg(
      params.base44,
      jpegBytes,
      `ig-prepared-${Date.now()}.jpg`
    );

    const updated = await params.base44.asServiceRole.entities.PreparedMedia.update(pending.id, {
      source_format: detected === "jpg" ? "jpeg" : detected,
      prepared_url: preparedUrl,
      prepared_format: "jpeg",
      width,
      height,
      file_size: jpegBytes.byteLength,
      status: "ready",
      error_code: "",
      error_message: "",
    });

    return {
      id: String(pending.id),
      sourceUrl,
      sourceFormat: detected === "jpg" ? "jpeg" : detected,
      preparedUrl,
      preparedFormat: "jpeg",
      purpose,
      width,
      height,
      fileSize: jpegBytes.byteLength,
      status: "ready",
      reused: false,
      ...(updated ? {} : {}),
    };
  } catch (err) {
    const code =
      err instanceof MediaPreparationError ? err.code : "MEDIA_PREPARATION_FAILED";
    const message =
      err instanceof MediaPreparationError
        ? err.message
        : "Media preparation failed. Try a different image.";
    console.error("[mediaPreparation]", code, message);
    try {
      await params.base44.asServiceRole.entities.PreparedMedia.update(pending.id, {
        status: "failed",
        error_code: code,
        error_message: message,
      });
    } catch {
      /* ignore */
    }
    if (err instanceof MediaPreparationError) throw err;
    throw new MediaPreparationError("MEDIA_PREPARATION_FAILED", message);
  }
}
