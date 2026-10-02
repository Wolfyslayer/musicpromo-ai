/**
 * WebCodecs / VideoFrame requires untainted bitmap sources.
 * Cross-origin HTTPS URLs (e.g. Supabase Storage) taint <img> unless CORS allows fetch.
 * Prefer local File/Blob; otherwise fetch with CORS into a blob: URL.
 */

function sameOrigin(url) {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * @param {{ url?: string, file?: Blob | null, label?: string }} opts
 * @returns {Promise<{ url: string, revoke?: () => void }>}
 */
export async function asBlobUrlForWebCodecs({ url, file, label = "Media" }) {
  if (file instanceof Blob) {
    const blobUrl = URL.createObjectURL(file);
    return { url: blobUrl, revoke: () => URL.revokeObjectURL(blobUrl) };
  }

  const raw = String(url || "").trim();
  if (!raw) throw new Error(`${label} is required for on-device render.`);
  if (raw.startsWith("blob:")) return { url: raw };
  if (sameOrigin(raw)) return { url: raw };

  try {
    const res = await fetch(raw, { mode: "cors", credentials: "omit", cache: "force-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    return { url: blobUrl, revoke: () => URL.revokeObjectURL(blobUrl) };
  } catch {
    throw new Error(
      `${label} could not be loaded for on-device video (browser CORS). ` +
        "Re-upload the file on this device, or in Supabase Storage enable CORS for " +
        `${window.location.origin}.`
    );
  }
}
