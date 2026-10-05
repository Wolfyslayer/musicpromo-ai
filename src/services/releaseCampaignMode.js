import { formatTracklistForAI } from "@/services/releaseDefaults";
import { sortReleaseTracks } from "@/services/releaseTracks";

export function isAlbumRelease(release) {
  return release?.release_type === "album";
}

/** Song row used for required campaign.song_id and AI context. */
export function pickAnchorSong(release, songs) {
  const ordered = sortReleaseTracks(songs || []);
  if (!ordered.length) return null;
  if (release?.primary_song_id) {
    const primary = ordered.find((s) => s.id === release.primary_song_id);
    if (primary) return primary;
  }
  return ordered[0];
}

export function buildAlbumSongForAI(release, songs, artistName) {
  const anchor = pickAnchorSong(release, songs);
  if (!anchor) return null;
  const ordered = sortReleaseTracks(songs);
  const descriptionParts = [
    release.description,
    `This is a full album release (${ordered.length} tracks). Plan one cohesive album promo campaign — tease singles, tracklist reveals, release day, and post-release momentum. Reference individual track titles by name in hooks and captions when promoting specific songs.`,
    formatTracklistForAI(release, ordered),
  ].filter(Boolean);

  return {
    ...anchor,
    title: release.title || anchor.title,
    description: descriptionParts.join("\n\n"),
    artwork_url: release.artwork_url || anchor.artwork_url,
    release_date: release.release_date || anchor.release_date,
    genre: release.genre || anchor.genre,
    language: release.language || anchor.language || "English",
    artistName: artistName || anchor.artistName,
  };
}

/** Per-track campaign: keep the song title the user entered; add release + tracklist context for EPs. */
export function buildTrackSongForAI(release, song, songs, artistName) {
  const ordered = sortReleaseTracks(songs || []);
  const focusTitle = song.title?.trim() || "Untitled";
  const parts = [
    song.description,
    release?.title ? `Release: ${release.title}` : "",
    ordered.length > 1 ? formatTracklistForAI(release, ordered) : "",
    `This campaign promotes the track "${focusTitle}" — use this exact title in hooks, captions, and CTAs.`,
  ].filter(Boolean);

  return {
    ...song,
    title: focusTitle,
    description: parts.join("\n\n"),
    artwork_url: song.artwork_url || release?.artwork_url || "",
    release_date: song.release_date || release?.release_date || null,
    genre: release?.genre || song.genre,
    language: release?.language || song.language || "English",
    artistName: artistName || song.artistName,
  };
}

/** Album: one campaign on the release. Singles/EP: one campaign per track (by song_id). */
export function resolveReleaseCampaignState(release, songs, campaigns) {
  const isAlbum = isAlbumRelease(release);
  const campaignBySong = Object.fromEntries((campaigns || []).map((c) => [c.song_id, c]));
  const releaseCampaigns = (campaigns || []).filter((c) => c.release_id === release?.id);

  if (isAlbum) {
    const albumCampaign = releaseCampaigns[0] || null;
    return {
      isAlbum: true,
      albumCampaign,
      campaignBySong,
      needsGeneration: Boolean(release?.id && songs?.length && !albumCampaign),
      pendingTrackCount: albumCampaign ? 0 : songs?.length || 0,
    };
  }

  const tracksNeedingCampaign = (songs || []).filter((s) => !campaignBySong[s.id]);
  return {
    isAlbum: false,
    albumCampaign: null,
    campaignBySong,
    needsGeneration: tracksNeedingCampaign.length > 0,
    pendingTrackCount: tracksNeedingCampaign.length,
    tracksNeedingCampaign,
  };
}
