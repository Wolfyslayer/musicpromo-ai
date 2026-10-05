/** Fields copied from release → every song on that release. */
export function songDefaultsFromRelease(release) {
  if (!release) return {};
  return {
    genre: release.genre || "",
    language: release.language || "English",
    artwork_url: release.artwork_url || "",
    release_date: release.release_date || null,
  };
}

export async function syncReleaseDefaultsToSongs(db, release, songs) {
  const defaults = songDefaultsFromRelease(release);
  const updates = (songs || []).map((s) =>
    db.entities.Song.update(s.id, {
      ...defaults,
      artist_id: s.artist_id || release.artist_id,
    })
  );
  await Promise.all(updates);
}

export function releaseDetailsReady(release) {
  return Boolean(
    release?.title?.trim() &&
      release?.artist_id &&
      release?.genre?.trim() &&
      release?.language?.trim()
  );
}

export function allSongsHaveAudio(songs) {
  return (songs || []).length > 0 && (songs || []).every((s) => Boolean(s.audio_url));
}

export function countSongsMissingAudio(songs) {
  return (songs || []).filter((s) => !s.audio_url).length;
}

const GENERIC_TRACK_PLACEHOLDER = /^track\s*\d*$/i;

/** Turn the track title textarea into concrete song titles (singles use release title when line is generic). */
export function resolveTrackTitlesFromInput(releaseType, releaseTitle, trackTitlesText) {
  const release = releaseTitle?.trim() || "";
  const lines = String(trackTitlesText || "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  if (releaseType === "single") {
    if (!lines.length) return release ? [release] : [];
    if (lines.length === 1 && (GENERIC_TRACK_PLACEHOLDER.test(lines[0]) || !lines[0])) {
      return release ? [release] : lines;
    }
    return lines;
  }
  return lines;
}

export function formatTracklistForAI(release, songs) {
  const ordered = [...(songs || [])].sort((a, b) => (a.track_number || 0) - (b.track_number || 0));
  if (!ordered.length) return "";
  const header = release?.title ? `Release: ${release.title}\n` : "";
  const body = ordered.map((s, i) => `${i + 1}. ${s.title || "Untitled"}`).join("\n");
  return `${header}Tracks on this release (use these exact names in hooks and captions where relevant):\n${body}`;
}
