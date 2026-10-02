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

  async function fetchBlob(fromUrl, headers = {}) {
    const res = await fetch(fromUrl, {
      mode: "cors",
      credentials: "omit",
      cache: "force-cache",
      headers,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  }

  try {
    let blob;
    try {
      blob = await fetchBlob(raw);
    } catch {
      const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
      const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
      if (supabaseUrl && anonKey && /supabase\.co/i.test(raw)) {
        const proxy = `${supabaseUrl}/functions/v1/promoMediaProxy?url=${encodeURIComponent(raw)}`;
        blob = await fetchBlob(proxy, {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        });
      } else {
        throw new Error("direct fetch failed");
      }
    }
    const blobUrl = URL.createObjectURL(blob);
    return { url: blobUrl, revoke: () => URL.revokeObjectURL(blobUrl) };
  } catch {
    throw new Error(
      `${label} could not be loaded for on-device video (CORS). ` +
        "Re-upload on this device, configure Storage CORS (see docs/STORAGE_CORS.md), " +
        "or deploy the promoMediaProxy Edge Function."
    );
  }
}
