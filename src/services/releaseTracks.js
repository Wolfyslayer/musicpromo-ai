/** Sort songs on a release by track_number, then title. */
export function sortReleaseTracks(songs) {
  return [...(songs || [])].sort((a, b) => {
    const ta = Number(a.track_number);
    const tb = Number(b.track_number);
    const aNum = Number.isFinite(ta) && ta > 0 ? ta : 9999;
    const bNum = Number.isFinite(tb) && tb > 0 ? tb : 9999;
    if (aNum !== bNum) return aNum - bNum;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}

/** Stagger campaign start dates across an album rollout. */
export function staggeredStartDate(baseStartIso, trackIndex, daysBetweenTracks) {
  const gap = Math.max(0, Number(daysBetweenTracks) || 0);
  if (!gap || trackIndex <= 0) return baseStartIso;
  const d = new Date(`${baseStartIso}T12:00:00`);
  d.setDate(d.getDate() + trackIndex * gap);
  return d.toISOString().slice(0, 10);
}
