/** Pick the best connected SocialAccount row for a provider + optional artist. */
export function pickSocialAccountForArtist(
  rows: Record<string, unknown>[] | null | undefined,
  provider: string,
  artistId?: string | null
): Record<string, unknown> | null {
  const pid = String(provider || "").toLowerCase();
  const aid = String(artistId || "").trim();
  const connected = (rows || []).filter(
    (r) => String(r.provider || "").toLowerCase() === pid && String(r.status || "") === "connected"
  );
  if (!connected.length) return null;
  if (aid) {
    const exact = connected.find((r) => String(r.artist_id || "") === aid);
    if (exact) return exact;
    const legacy = connected.find((r) => !String(r.artist_id || "").trim());
    return legacy || null;
  }
  return connected[0] || null;
}

/** When disconnecting/reconnecting, only touch rows for the same artist scope. */
export function sameArtistScope(
  row: Record<string, unknown>,
  artistId?: string | null
): boolean {
  const aid = String(artistId || "").trim();
  const rowArtist = String(row.artist_id || "").trim();
  if (!aid) return !rowArtist;
  return rowArtist === aid;
}
