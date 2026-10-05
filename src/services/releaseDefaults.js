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
