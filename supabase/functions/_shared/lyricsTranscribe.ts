const MAX_CUES = 48;
const MAX_WORDS = 8;
const MAX_CHARS = 42;
const GAP_SEC = 0.45;

type Word = { text: string; start: number; end: number };

export function groupWhisperWords(words: Word[], durationSec: number) {
  const lines: { text: string; start: number; end: number }[] = [];
  let current: { words: string[]; start: number; end: number } | null = null;

  const flush = () => {
    if (!current?.words.length) return;
    lines.push({
      text: current.words.join(" "),
      start: current.start,
      end: current.end,
    });
    current = null;
  };

  for (const word of words) {
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

  const cap = Math.max(1, durationSec);
  return lines.slice(0, MAX_CUES).map((line) => ({
    text: line.text,
    start: line.start,
    end: Math.min(cap, line.end),
    timeSeconds: line.start,
  }));
}

export async function openAiWhisperWords(
  audioBytes: ArrayBuffer,
  fileName: string,
  mimeType: string,
): Promise<Word[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("AI_API_KEY") || "";
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for lyrics transcription.");

  const base = Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1";
  const form = new FormData();
  form.append("file", new Blob([audioBytes], { type: mimeType || "audio/mpeg" }), fileName || "audio.mp3");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");

  const res = await fetch(`${base.replace(/\/$/, "")}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Whisper failed (${res.status})`);
  }

  const json = await res.json();
  const words: Word[] = [];
  for (const seg of json.words || []) {
    const text = String(seg.word || seg.text || "").trim();
    if (!text) continue;
    words.push({
      text,
      start: Number(seg.start) || 0,
      end: Number(seg.end) || Number(seg.start) || 0,
    });
  }
  if (words.length) return words;

  for (const seg of json.segments || []) {
    const text = String(seg.text || "").trim();
    if (!text) continue;
    words.push({
      text,
      start: Number(seg.start) || 0,
      end: Number(seg.end) || Number(seg.start) || 0,
    });
  }
  return words;
}
