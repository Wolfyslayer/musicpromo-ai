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
 * Prefer artist-scoped OAuth connection for the Social Hub.
 * Pass `artistId` = `null` to ignore artist scope (any connected account for this provider).
 */
export function connectionForProvider(connections, providerId, artistId = undefined) {
  const pid = String(providerId || "").toLowerCase();
  const aid =
    artistId === null
      ? ""
      : String(artistId !== undefined ? artistId : getSocialArtistId() || "").trim();
  const rows = (connections || [])
    .map((c) => ({
      ...c,
      provider: String(c.provider || "").toLowerCase(),
      artistId: String(c.artistId || c.artist_id || "").trim(),
    }))
    .filter((c) => c.provider === pid && c.status === "connected");

  if (!rows.length) return null;
  if (aid) {
    const exact = rows.find((c) => c.artistId === aid);
    if (exact) return exact;
    const legacy = rows.find((c) => !c.artistId);
    return legacy || null;
  }
  return rows[0];
}
