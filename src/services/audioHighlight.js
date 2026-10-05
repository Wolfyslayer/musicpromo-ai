/** Pick the best ~15s promo clip start from AI analysis + lyrics (engagement-focused hook). */

function parseTimeToSeconds(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  const mmss = s.match(/^(\d{1,2}):(\d{2}(?:\.\d+)?)$/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function clampStart(offset, audioDurationSec, clipSec = 15) {
  const dur = Math.max(0, Number(audioDurationSec) || 0);
  if (dur <= clipSec + 2) return 0;
  const max = Math.max(0, dur - clipSec - 0.5);
  return Math.min(max, Math.max(0, Number(offset) || 0));
}

function lyricIndexToSeconds(index, lyricsLength, audioDurationSec) {
  if (!lyricsLength || !audioDurationSec) return 0;
  const ratio = Math.min(1, Math.max(0, index / lyricsLength));
  return ratio * audioDurationSec * 0.92;
}

/**
 * @returns {number} seconds into the track where the promo should start
 */
export function resolveBestAudioStartOffset({
  song,
  analysis,
  aiDay,
  audioDurationSec = 0,
  clipDurationSec = 15,
}) {
  const duration =
    Math.max(0, Number(audioDurationSec) || 0) ||
    Math.max(0, Number(song?.duration) || 0) ||
    Math.max(0, Number(song?.audio_duration) || 0);

  const merged = { ...(song?.analysis || {}), ...(analysis || {}) };

  const timed =
    merged.highlightMoments ||
    merged.hookMoments ||
    merged.bestMoments ||
    merged.promoMoments;
  if (Array.isArray(timed)) {
    for (const item of timed) {
      const raw =
        typeof item === "object" && item
          ? item.startSec ?? item.start ?? item.time ?? item.timestamp
          : item;
      const sec = parseTimeToSeconds(raw);
      if (sec != null) return clampStart(sec, duration, clipDurationSec);
    }
  }

  const hookLine =
    String(aiDay?.hook || "").trim() ||
    (Array.isArray(merged.hookSections) ? String(merged.hookSections[0] || "").trim() : "");
  const lyrics = String(song?.lyrics || merged.lyrics || "").trim();
  if (hookLine && lyrics.length > 20) {
    const needle = hookLine.slice(0, Math.min(48, hookLine.length)).toLowerCase();
    const idx = lyrics.toLowerCase().indexOf(needle);
    if (idx >= 0) {
      return clampStart(lyricIndexToSeconds(idx, lyrics.length, duration), duration, clipDurationSec);
    }
  }

  const energy = merged?.assetProfile?.energy ?? merged?.energy;
  if (typeof energy === "number" && energy >= 0.72) {
    return clampStart(duration * 0.26, duration, clipDurationSec);
  }
  if (String(energy || "").toLowerCase() === "high") {
    return clampStart(duration * 0.28, duration, clipDurationSec);
  }

  if (duration > 45) {
    return clampStart(duration * 0.38, duration, clipDurationSec);
  }
  if (duration > 25) {
    return clampStart(duration * 0.22, duration, clipDurationSec);
  }
  return 0;
}
