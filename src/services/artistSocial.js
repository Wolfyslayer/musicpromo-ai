import { db } from "@/api/base44Client";
import { setSocialArtistId } from "@/services/socialArtistScope";

const LEGACY_ASSIGN_KEY = "musicpromo:legacy_social_assigned";

/** Default community + social fields for artists created before profile/community shipped. */
export function normalizeArtistRow(artist) {
  if (!artist || typeof artist !== "object") return artist;
  return {
    ...artist,
    show_on_public_profile: artist.show_on_public_profile !== false,
    profile_image_from_provider: artist.profile_image_from_provider || "",
  };
}

export function openSocialConnectForArtist(navigate, artistId) {
  if (artistId) setSocialArtistId(artistId);
  navigate(artistId ? `/social/connect?artist=${encodeURIComponent(artistId)}` : "/social/connect");
}

/** One-time: move legacy account-wide OAuth rows onto the user's only artist. */
export async function assignLegacySocialToArtistIfNeeded(artistId, { force = false } = {}) {
  if (!artistId || typeof window === "undefined") return { updated: 0 };
  const flag = `${LEGACY_ASSIGN_KEY}:${artistId}`;
  if (!force && sessionStorage.getItem(flag) === "1") return { updated: 0 };

  const res = await db.functions.invoke("assignLegacySocialToArtist", { artistId });
  const body = res?.data ?? res;
  if (body?.ok) {
    sessionStorage.setItem(flag, "1");
    return { updated: Number(body.updated) || 0 };
  }
  return { updated: 0 };
}
