const KEY = "musicpromo_social_artist_id";

export function getSocialArtistId() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setSocialArtistId(artistId) {
  try {
    if (artistId) localStorage.setItem(KEY, String(artistId));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Artist-scoped OAuth connection only — requires a non-empty artist id.
 */
export function connectionForProvider(connections, providerId, artistId = undefined) {
  const pid = String(providerId || "").toLowerCase();
  const aid = String(artistId !== undefined ? artistId : getSocialArtistId() || "").trim();
  if (!aid) return null;

  const rows = (connections || [])
    .map((c) => ({
      ...c,
      provider: String(c.provider || "").toLowerCase(),
      artistId: String(c.artistId || c.artist_id || "").trim(),
    }))
    .filter((c) => c.provider === pid && c.status === "connected" && c.artistId === aid);

  return rows[0] || null;
}
