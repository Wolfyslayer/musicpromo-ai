const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_AUDIO_BYTES = 14 * 1024 * 1024;

function maxImageBytes(): number {
  const raw = Deno.env.get("GEMINI_MAX_IMAGE_BYTES");
  const n = raw ? Number(raw) : DEFAULT_MAX_IMAGE_BYTES;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_IMAGE_BYTES;
}

function maxAudioBytes(): number {
  const raw = Deno.env.get("GEMINI_MAX_AUDIO_BYTES");
  const n = raw ? Number(raw) : DEFAULT_MAX_AUDIO_BYTES;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_AUDIO_BYTES;
}

export function guessMimeFromUrl(url: string, kind: "image" | "audio"): string {
  const path = String(url || "").split("?")[0].toLowerCase();
  if (kind === "image") {
    if (path.endsWith(".png")) return "image/png";
    if (path.endsWith(".webp")) return "image/webp";
    if (path.endsWith(".gif")) return "image/gif";
    return "image/jpeg";
  }
  if (path.endsWith(".wav")) return "audio/wav";
  if (path.endsWith(".m4a") || path.endsWith(".mp4")) return "audio/mp4";
  return "audio/mpeg";
}

export async function fetchMediaBytes(
  url: string,
  kind: "image" | "audio"
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const target = String(url || "").trim();
  if (!target.startsWith("http://") && !target.startsWith("https://")) {
    throw new Error("media_fetch: URL must be http(s)");
  }
  const res = await fetch(target, { redirect: "follow" });
  if (!res.ok) throw new Error(`media_fetch: HTTP ${res.status}`);
  const mimeType =
    (res.headers.get("content-type") || "").split(";")[0].trim() ||
    guessMimeFromUrl(target, kind);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (!buf.byteLength) throw new Error("media_fetch: empty body");
  const cap = kind === "image" ? maxImageBytes() : maxAudioBytes();
  if (buf.byteLength > cap) {
    throw new Error(`media_fetch: ${kind} too large (${buf.byteLength} > ${cap})`);
  }
  return { bytes: buf, mimeType };
}

/** Download public HTTPS media for TikTok / YouTube / X uploads (videos up to 256MB). */
export async function fetchPublicMediaBytes(url: string): Promise<Uint8Array> {
  const target = String(url || "").trim();
  if (!target.startsWith("http://") && !target.startsWith("https://")) {
    throw new Error("media_fetch: URL must be http(s)");
  }
  const res = await fetch(target, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`media_fetch: HTTP ${res.status}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (!buf.byteLength) throw new Error("media_fetch: empty body");
  if (buf.byteLength > 256 * 1024 * 1024) {
    throw new Error("media_fetch: file too large (>256MB)");
  }
  return buf;
}
