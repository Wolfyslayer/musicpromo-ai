/**
 * Lyric auto-sync. The free in-browser Whisper model runs inside the hidden WebView of <RenderHost />
 * (the web app's own lyrics worker), so no paid transcription API is involved.
 */

import { getRenderBridge } from "@/lib/renderBridge";
import { resolveAssetUrl, uploadPromoAsset } from "@/services/supabaseStore";

const MAX_CUES = 48;
const MAX_WORDS = 8;
const MAX_CHARS = 42;
const GAP_SEC = 0.45;
const LISTENING = "AI is listening and syncing your lyrics...";

export class LyricsSyncUnavailableError extends Error {
  constructor(message) {
    super(message || "Automatic lyric sync is not available right now. Type the lyrics or import an SRT file.");
    this.name = "LyricsSyncUnavailableError";
    this.code = "TRANSCRIPTION_NOT_CONFIGURED";
  }
}

function cleanToken(text) {
  return String(text || "")
    .replace(/<\|[^|]+?\|>/g, " ")
    .replace(/\[[^\]]{0,48}\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSpoken(text) {
  return /[0-9a-z\u00c0-\u024f]/i.test(text);
}

function chunkTimes(chunk) {
  const ts = chunk?.timestamp ?? chunk?.timestamps;
  let start = Array.isArray(ts) ? Number(ts[0]) : Number(chunk?.start);
  let end = Array.isArray(ts) ? Number(ts[1]) : Number(chunk?.end);
  if (!Number.isFinite(start)) start = 0;
  if (!Number.isFinite(end) || end < start) end = start + 0.28;
  return { start, end };
}

function wordsFromChunks(chunks) {
  const words = [];
  for (const chunk of chunks || []) {
    const cleaned = cleanToken(chunk?.text);
    if (!cleaned || !isSpoken(cleaned)) continue;
    const { start, end } = chunkTimes(chunk);
    const parts = cleaned.split(" ").filter(isSpoken);
    if (!parts.length) continue;
    if (parts.length === 1) {
      words.push({ text: parts[0], start, end });
      continue;
    }
    const step = Math.max(0.05, end - start) / parts.length;
    for (let i = 0; i < parts.length; i += 1) {
      words.push({ text: parts[i], start: start + i * step, end: start + (i + 1) * step });
    }
  }
  return words;
}

/** Turn transcript chunks into lyric cues: `{ text, start, end, timeSeconds }`. */
export function groupWhisperChunks(chunks, durationSec = 30) {
  const duration = Math.max(1, Number(durationSec) || 30);
  const words = wordsFromChunks(chunks).filter((word) => word.start < duration);
  const lines = [];
  let current = null;

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

function isPickedFile(file) {
  return Boolean(file) && typeof file === "object" && typeof file.uri === "string" && file.uri.length > 0;
}

async function publicAudioUrl({ audioUrl, audioFile }) {
  if (isPickedFile(audioFile)) {
    const uploaded = await uploadPromoAsset(audioFile, "audio");
    return uploaded?.publicUrl || "";
  }
  const raw = String(audioUrl || "").trim();
  if (!raw) return "";
  if (/^file:|^content:/i.test(raw)) {
    const uploaded = await uploadPromoAsset({ uri: raw, name: `audio-${Date.now()}.mp3`, type: "audio/mpeg" }, "audio");
    return uploaded?.publicUrl || "";
  }
  if (/^https:\/\//i.test(raw)) return raw;
  return (await resolveAssetUrl(raw).catch(() => "")) || "";
}

function cuesFromResponse(data, duration) {
  const segments = Array.isArray(data?.cues) ? data.cues : [];
  const lines = segments
    .map((cue) => ({
      text: cleanToken(cue?.text),
      start: Math.max(0, Number(cue?.start) || 0),
      end: Math.max(0, Number(cue?.end) || 0),
    }))
    .filter((cue) => cue.text && isSpoken(cue.text) && cue.start < duration)
    .slice(0, MAX_CUES);
  if (lines.length) {
    return lines.map((cue) => {
      const start = Number(cue.start.toFixed(2));
      const end = Number(Math.max(start, Math.min(duration, cue.end)).toFixed(2));
      return { text: cue.text, start, end, timeSeconds: start };
    });
  }
  if (data?.text) {
    return groupWhisperChunks([{ text: data.text, timestamp: [0, duration] }], duration);
  }
  return [];
}

/**
 * Transcribe the song on the device (web Whisper model in the hidden WebView) and return timed lyric lines.
 * @param {{ audioUrl?: string, audioFile?: { uri: string } | null, durationSec?: number, onProgress?: (info: { phase?: string, progress?: number, message?: string }) => void }} [options]
 */
export async function syncLyricsFromAudio({ audioUrl, audioFile, durationSec = 15, onProgress } = {}) {
  const duration = Math.min(600, Math.max(1, Number(durationSec) || 15));
  onProgress?.({ phase: "upload", progress: 2, message: LISTENING });

  const url = await publicAudioUrl({ audioUrl, audioFile });
  if (!url) throw new Error("Upload song audio before syncing lyrics.");

  try {
    const result = await getRenderBridge().transcribe({ audioUrl: url, durationSec: duration, onProgress });
    return Array.isArray(result?.cues) ? result.cues : [];
  } catch (err) {
    throw new LyricsSyncUnavailableError(
      `${err?.message || "Lyrics sync failed."} You can still type the lyrics or import an SRT file.`
    );
  }
}
