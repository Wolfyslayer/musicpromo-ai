const MAX_CUES = 48;
const MAX_WORDS = 8;
const MAX_CHARS = 42;
const GAP_SEC = 0.45;

export type LyricCue = { text: string; start: number; end: number; timeSeconds: number };

function cleanToken(text: string) {
  return String(text || "")
    .replace(/<\|[^|]+?\|>/g, " ")
    .replace(/\[[^\]]{0,48}\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSpoken(text: string) {
  return /[0-9a-z\u00c0-\u024f]/i.test(text);
}

function chunkTimes(chunk: { timestamp?: number[]; timestamps?: number[]; start?: number; end?: number }) {
  const ts = chunk?.timestamp ?? chunk?.timestamps;
  let start = Array.isArray(ts) ? Number(ts[0]) : Number(chunk?.start);
  let end = Array.isArray(ts) ? Number(ts[1]) : Number(chunk?.end);
  if (!Number.isFinite(start)) start = 0;
  if (!Number.isFinite(end) || end < start) end = start + 0.28;
  return { start, end };
}

function wordsFromChunks(chunks: { text?: string; timestamp?: number[]; timestamps?: number[]; start?: number; end?: number }[]) {
  const words: { text: string; start: number; end: number }[] = [];
  for (const chunk of chunks || []) {
    const cleaned = cleanToken(chunk?.text || "");
    if (!cleaned || !isSpoken(cleaned)) continue;
    const { start, end } = chunkTimes(chunk);
    const parts = cleaned.split(" ").filter(isSpoken);
    if (!parts.length) continue;
    if (parts.length === 1) {
      words.push({ text: parts[0], start, end });
      continue;
    }
    const span = Math.max(0.05, end - start);
    const step = span / parts.length;
    for (let i = 0; i < parts.length; i += 1) {
      words.push({ text: parts[i], start: start + i * step, end: start + (i + 1) * step });
    }
  }
  return words;
}

/** Same line grouping the web studio uses after Whisper. */
export function groupWhisperChunks(chunks: { text?: string; timestamp?: number[] }[], durationSec = 30): LyricCue[] {
  const duration = Math.max(1, Number(durationSec) || 30);
  const words = wordsFromChunks(chunks).filter((word) => word.start < duration);
  const lines: { text: string; start: number; end: number }[] = [];
  let current: { words: string[]; start: number; end: number } | null = null;

  const flush = () => {
    if (!current) return;
    const text = current.words.join(" ").replace(/\s+/g, " ").trim();
    const start = Math.max(0, Math.min(duration, current.start));
    const end = Math.max(start, Math.min(duration, current.end));
    current = null;
    if (!text) return;
    const prev = lines[lines.length - 1];
    if (prev && prev.text.toLowerCase() === text.toLowerCase()) {
      prev.end = Number(end.toFixed(2));
      return;
    }
    lines.push({ text, start: Number(start.toFixed(2)), end: Number(end.toFixed(2)) });
  };

  for (const word of words) {
    if (lines.length >= MAX_CUES) break;
    if (!current) {
      current = { words: [word.text], start: word.start, end: word.end };
      continue;
    }
    const gap = word.start - current.end;
    const nextText = `${current.words.join(" ")} ${word.text}`;
    if (gap > GAP_SEC || current.words.length >= MAX_WORDS || nextText.length > MAX_CHARS) {
      flush();
      if (lines.length >= MAX_CUES) break;
      current = { words: [word.text], start: word.start, end: word.end };
    } else {
      current.words.push(word.text);
      current.end = word.end;
    }
  }
  flush();

  return lines.slice(0, MAX_CUES).map((line) => ({
    text: line.text,
    start: line.start,
    end: line.end,
    timeSeconds: line.start,
  }));
}
