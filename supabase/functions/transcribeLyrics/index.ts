import { createClientFromRequest } from "../_shared/runtime.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";
import { groupWhisperWords, openAiWhisperWords } from "../_shared/lyricsTranscribe.ts";

async function fetchAudio(url: string): Promise<{ bytes: ArrayBuffer; mime: string; name: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not download audio for transcription.");
  const mime = res.headers.get("content-type") || "audio/mpeg";
  const bytes = await res.arrayBuffer();
  const name = url.split("/").pop()?.split("?")[0] || "track.mp3";
  return { bytes, mime, name };
}

async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const audioUrl = String(body?.audioUrl || body?.audio_url || "").trim();
    const durationSec = Math.min(600, Math.max(1, Number(body?.durationSec || body?.duration || 15) || 15));
    if (!audioUrl) {
      return jsonWithCors(req, { error: "audioUrl is required." }, 400);
    }

    const { bytes, mime, name } = await fetchAudio(audioUrl);
    const maxBytes = 24 * 1024 * 1024;
    if (bytes.byteLength > maxBytes) {
      return jsonWithCors(req, { error: "Audio file is too large for transcription (max 24MB)." }, 400);
    }

    const words = await openAiWhisperWords(bytes, name, mime);
    const cues = groupWhisperWords(words, durationSec);
    return jsonWithCors(req, { cues, words: words.length });
  } catch (error) {
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);
