/**
 * Download a public HTTPS media file for TikTok / YouTube uploads.
 */
export async function fetchPublicMediaBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { redirect: "follow" });
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
