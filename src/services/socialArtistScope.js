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

function normalizeConnectionRow(c) {
  const row = c && typeof c === "object" ? c : {};
  return {
    ...row,
    id: row.id,
    provider: String(row.provider || row.platform || "").toLowerCase(),
    artistId: String(row.artistId || row.artist_id || "").trim(),
    status: row.status || "connected",
    username: row.username ?? null,
    canPublish: row.canPublish,
    needsPublishReauth: row.needsPublishReauth,
    scopes: row.scopes ?? null,
  };
}

/**
 * Artist-scoped OAuth connection only — requires a non-empty artist id.
 */
export function connectionForProvider(connections, providerId, artistId = undefined) {
  const pid = String(providerId || "").toLowerCase();
  const aid = String(artistId !== undefined ? artistId : getSocialArtistId() || "").trim();
  if (!aid) return null;

  const rows = (connections || [])
    .map(normalizeConnectionRow)
    .filter((c) => c.provider === pid && c.status === "connected" && c.artistId === aid);

  return rows[0] || null;
}

/**
 * Best artist id for compose / publish when campaign context may be missing (e.g. ?post= only).
 */
export function resolveComposeArtistId({ campaign, release, song } = {}) {
  return (
    String(campaign?.artist_id || "").trim() ||
    String(release?.artist_id || "").trim() ||
    String(song?.artist_id || "").trim() ||
    String(getSocialArtistId() || "").trim()
  );
}

/**
 * Resolve the live connection for manual compose: campaign artist, post account, Social Hub artist, or sole match.
 */
export function resolveConnectionForCompose(connections, providerId, { artistId = "", post } = {}) {
  const pid = String(providerId || "").toLowerCase();
  const list = (connections || []).map(normalizeConnectionRow);
  const connectedForProvider = list.filter((c) => c.provider === pid && c.status === "connected");

  const attachArtist = (conn, fallbackArtistId) => {
    if (!conn) return null;
    const aid = String(conn.artistId || fallbackArtistId || "").trim();
    return aid ? { ...conn, artistId: aid } : conn;
  };

  const explicitArtist = String(artistId || "").trim();
  if (explicitArtist) {
    const match = connectionForProvider(connections, pid, explicitArtist);
    if (match) return attachArtist(match, explicitArtist);
  }

  const accountId = String(post?.socialAccountId || post?.social_account_id || "").trim();
  if (accountId) {
    const byAccount = connectedForProvider.find((c) => String(c.id || "") === accountId);
    if (byAccount) return attachArtist(byAccount, explicitArtist || getSocialArtistId());
  }

  const hubArtist = String(getSocialArtistId() || "").trim();
  if (hubArtist && hubArtist !== explicitArtist) {
    const hubMatch = connectionForProvider(connections, pid, hubArtist);
    if (hubMatch) return attachArtist(hubMatch, hubArtist);
  }

  if (connectedForProvider.length === 1) {
    return attachArtist(connectedForProvider[0], explicitArtist || hubArtist);
  }

  return null;
}
