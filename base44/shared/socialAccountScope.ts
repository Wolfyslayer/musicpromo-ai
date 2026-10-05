/** Pick the connected SocialAccount row for a provider + artist (strict — no account-wide fallback). */
export function pickSocialAccountForArtist(
  rows: Record<string, unknown>[] | null | undefined,
  provider: string,
  artistId?: string | null
): Record<string, unknown> | null {
  const pid = String(provider || "").toLowerCase();
  const aid = String(artistId || "").trim();
  if (!aid) return null;

  const connected = (rows || []).filter(
    (r) =>
      String(r.provider || "").toLowerCase() === pid &&
      String(r.status || "") === "connected" &&
      String(r.artist_id || "").trim() === aid
  );
  return connected[0] || null;
}

export function sameArtistScope(
  row: Record<string, unknown>,
  artistId?: string | null
): boolean {
  const aid = String(artistId || "").trim();
  const rowArtist = String(row.artist_id || "").trim();
  if (!aid || !rowArtist) return false;
  return rowArtist === aid;
}
