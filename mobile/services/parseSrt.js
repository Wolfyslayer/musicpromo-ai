const TIME_IN_LINE =
  /(\d+:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d+:\d{2}:\d{2}[,.]\d{1,3})/;

/**
 * Convert an SRT timestamp such as `00:01:23,456` into seconds.
 * Accepts a comma or a dot before the milliseconds.
 */
export function srtTimestampToSeconds(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d+):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = Number(match[4].padEnd(3, "0"));
  if (minutes > 59 || seconds > 59) return null;
  if (![hours, minutes, seconds, millis].every(Number.isFinite)) return null;
  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

function stripSubtitleTags(text) {
  let withoutNotes = String(text || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/\{\\[^}]*\}/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
  for (let pass = 0; pass < 8; pass += 1) {
    const next = withoutNotes.replace(/\[[^[\]]*\]/g, " ");
    if (next === withoutNotes) break;
    withoutNotes = next;
  }
  return withoutNotes.replace(/\s+/g, " ").trim();
}

/** Format seconds as an SRT clock, e.g. 83.456 → `00:01:23,456`. */
export function formatSRTTimestamp(seconds) {
  const totalMs = Math.round(Math.max(0, Number(seconds) || 0) * 1000);
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const secs = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (value, width = 2) => String(value).padStart(width, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(ms, 3)}`;
}

function isCueIndex(line, lines, index) {
  if (!/^\d+$/.test(line)) return false;
  let look = index + 1;
  while (look < lines.length && !lines[look].trim()) look += 1;
  return look < lines.length && TIME_IN_LINE.test(lines[look].trim());
}

/**
 * Parse SRT subtitle text into lyric cues.
 * Blank index rows, trailing whitespace, and missing carriage returns are skipped
 * without shifting later cues.
 */
export function parseSRT(fileContent) {
  const normalized = String(fileContent || "")
    .replace(/^\uFEFF/, "")
    .replace(/\u00A0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const cues = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    const timing = line.match(TIME_IN_LINE);
    if (!timing) {
      i += 1;
      continue;
    }

    const start = srtTimestampToSeconds(timing[1]);
    const end = srtTimestampToSeconds(timing[2]);
    i += 1;
    const textLines = [];

    while (i < lines.length) {
      const nextRaw = lines[i];
      const next = nextRaw.trim();
      if (!next) {
        i += 1;
        break;
      }
      if (TIME_IN_LINE.test(next) || isCueIndex(next, lines, i)) break;
      textLines.push(next);
      i += 1;
    }

    if (start == null || end == null || end < start) continue;
    const text = stripSubtitleTags(textLines.join(" "));
    if (!text) continue;
    cues.push({ text, start, end, order: cues.length });
  }

  return cues
    .sort((a, b) => a.start - b.start || a.order - b.order)
    .map(({ text, start, end }) => ({ text, start, end }));
}
