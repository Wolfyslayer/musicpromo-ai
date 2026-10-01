const SAMPLE_RATE = 16000;
const MAX_CUES = 48;
const MAX_WORDS = 8;
const MAX_CHARS = 42;
const GAP_SEC = 0.45;
const LISTENING = "AI is listening and syncing your lyrics...";

let worker = null;
let requestId = 0;

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("../workers/lyricsSync.worker.js", import.meta.url), {
      type: "module",
    });
  }
  return worker;
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
    const span = Math.max(0.05, end - start);
    const step = span / parts.length;
    for (let i = 0; i < parts.length; i += 1) {
      words.push({
        text: parts[i],
        start: start + i * step,
        end: start + (i + 1) * step,
      });
    }
  }
  return words;
}

/**
 * Turn Whisper chunks into lyric cues: `{ text, start, end, timeSeconds }`.
 */
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
    lines.push({
      text,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
    });
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

async function readAudioBytes(source) {
  if (source instanceof Blob) return source.arrayBuffer();
  const response = await fetch(String(source || ""));
  if (!response.ok) throw new Error("Could not load the song audio for lyrics sync.");
  return response.arrayBuffer();
}

/** Decode the uploaded track in the browser. Whisper reads the buffer's samples. */
async function decodeToAudioBuffer(source) {
  const encoded = await readAudioBytes(source);
  const ctx = new AudioContext();
  try {
    if (ctx.state === "suspended") await ctx.resume();
    return await ctx.decodeAudioData(encoded.slice(0));
  } finally {
    await ctx.close().catch(() => {});
  }
}

async function audioBufferTo16k(audioBuffer, maxSeconds) {
  const seconds = Math.min(
    maxSeconds,
    Number.isFinite(audioBuffer.duration) ? audioBuffer.duration : maxSeconds
  );
  const length = Math.max(1, Math.ceil(seconds * SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, length, SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  return new Float32Array(rendered.getChannelData(0));
}

/**
 * Transcribe a playable audio URL in the browser and return timed lyric lines.
 */
export async function syncLyricsFromAudio({ audioUrl, audioFile, durationSec = 15, onProgress } = {}) {
  const source = audioFile instanceof Blob ? audioFile : String(audioUrl || "").trim();
  if (!source) throw new Error("Upload song audio before syncing lyrics.");

  const duration = Math.min(600, Math.max(1, Number(durationSec) || 15));
  onProgress?.({ phase: "decode", progress: 3, message: LISTENING });

  const audioBuffer = await decodeToAudioBuffer(source);
  const pcm = await audioBufferTo16k(audioBuffer, duration);
  const activeWorker = getWorker();
  const id = ++requestId;

  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const data = event.data || {};
      if (data.type === "progress") {
        onProgress?.({
          phase: data.phase,
          progress: data.progress,
          message: data.message || LISTENING,
        });
        return;
      }
      if (data.type === "done") {
        cleanup();
        const chunks = Array.isArray(data.chunks) && data.chunks.length
          ? data.chunks
          : data.text
            ? [{ text: data.text, timestamp: [0, duration] }]
            : [];
        resolve(groupWhisperChunks(chunks, duration));
        return;
      }
      if (data.type === "error") {
        cleanup();
        reject(new Error(data.message || "Lyrics sync failed."));
      }
    };

    const onError = () => {
      cleanup();
      worker = null;
      reject(new Error("The lyrics model stopped unexpectedly."));
    };

    const cleanup = () => {
      activeWorker.removeEventListener("message", onMessage);
      activeWorker.removeEventListener("error", onError);
    };

    activeWorker.addEventListener("message", onMessage);
    activeWorker.addEventListener("error", onError);
    activeWorker.postMessage({ type: "transcribe", id, audio: pcm, duration }, [pcm.buffer]);
  });
}
