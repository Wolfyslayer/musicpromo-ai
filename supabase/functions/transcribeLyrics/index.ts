import { createClientFromRequest } from "../_shared/runtime.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";
import { isPublicHttpsUrl } from "../_shared/instagramPublishing.ts";

/**
 * Timed lyric cues from a song file via the OpenAI transcription API.
 * Body: { audioUrl: string, language?: string }
 * Returns: { ok: true, cues: [{ start, end, text }], text } or { ok: false, code: "TRANSCRIPTION_NOT_CONFIGURED" }.
 *
 * Secrets: OPENAI_API_KEY (required), OPENAI_BASE_URL (optional).
 */

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_CUES = 200;

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return true;
  }
  if (host.startsWith("[") || host.includes(":")) return true;
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  );
}

function apiBase(): string {
  return (Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/+$/, "");
}

function fileNameFor(url: URL, contentType: string): string {
  const fromPath = decodeURIComponent(url.pathname.split("/").pop() || "").replace(/[^\w.\-]+/g, "_");
  if (/\.(mp3|mp4|m4a|wav|webm|mpeg|mpga|ogg|flac)$/i.test(fromPath)) return fromPath;
  if (/mpeg|mp3/i.test(contentType)) return "audio.mp3";
  if (/mp4|m4a|aac/i.test(contentType)) return "audio.m4a";
  if (/wav/i.test(contentType)) return "audio.wav";
  if (/ogg/i.test(contentType)) return "audio.ogg";
  if (/flac/i.test(contentType)) return "audio.flac";
  return "audio.mp3";
}

async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return jsonWithCors(req, { error: "Unauthorized" }, 401);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY") || "";
    if (!apiKey) {
      return jsonWithCors(
        req,
        {
          ok: false,
          code: "TRANSCRIPTION_NOT_CONFIGURED",
          error: "Automatic lyric sync is not configured on the server (TRANSCRIPTION_NOT_CONFIGURED). Type the lyrics or import an SRT file.",
        },
        503
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const audioUrl = String(body.audioUrl || "").trim();
    let parsed: URL;
    try {
      parsed = new URL(audioUrl);
    } catch {
      return jsonWithCors(req, { ok: false, error: "audioUrl must be a public HTTPS URL.", code: "INVALID_AUDIO_URL" }, 400);
    }
    if (!isPublicHttpsUrl(audioUrl) || isBlockedHost(parsed.hostname)) {
      return jsonWithCors(req, { ok: false, error: "audioUrl must be a public HTTPS URL.", code: "INVALID_AUDIO_URL" }, 400);
    }
    const language = /^[a-z]{2,3}$/i.test(String(body.language || "")) ? String(body.language).toLowerCase() : "";

    const audioRes = await fetch(audioUrl, { redirect: "follow" });
    if (!audioRes.ok) {
      return jsonWithCors(req, { ok: false, error: "Could not download the song audio.", code: "AUDIO_FETCH_FAILED" }, 400);
    }
    const declared = Number(audioRes.headers.get("content-length") || 0);
    if (declared > MAX_AUDIO_BYTES) {
      return jsonWithCors(req, { ok: false, error: "Audio is larger than 25 MB.", code: "AUDIO_TOO_LARGE" }, 413);
    }
    const bytes = new Uint8Array(await audioRes.arrayBuffer());
    if (!bytes.byteLength) {
      return jsonWithCors(req, { ok: false, error: "The song audio is empty.", code: "AUDIO_FETCH_FAILED" }, 400);
    }
    if (bytes.byteLength > MAX_AUDIO_BYTES) {
      return jsonWithCors(req, { ok: false, error: "Audio is larger than 25 MB.", code: "AUDIO_TOO_LARGE" }, 413);
    }

    const contentType = audioRes.headers.get("content-type") || "audio/mpeg";
    const form = new FormData();
    form.append("file", new File([bytes], fileNameFor(parsed, contentType), { type: contentType }));
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    if (language) form.append("language", language);

    const res = await fetch(`${apiBase()}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      console.error("[transcribeLyrics] openai", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return jsonWithCors(
        req,
        { ok: false, error: "The transcription service could not process this audio.", code: "TRANSCRIPTION_FAILED" },
        502
      );
    }

    const data = (await res.json()) as {
      text?: string;
      segments?: Array<{ start?: number; end?: number; text?: string }>;
    };
    const cues = (data.segments || [])
      .map((segment) => {
        const start = Math.max(0, Number(segment.start) || 0);
        const end = Math.max(start, Number(segment.end) || start);
        return {
          start: Number(start.toFixed(2)),
          end: Number(end.toFixed(2)),
          text: String(segment.text || "").replace(/\s+/g, " ").trim(),
        };
      })
      .filter((cue) => cue.text)
      .slice(0, MAX_CUES);

    return jsonWithCors(req, { ok: true, cues, text: String(data.text || "").trim() });
  } catch (error) {
    console.error("[transcribeLyrics]", (error as Error)?.message || error);
    return jsonWithCors(req, { ok: false, error: "Could not transcribe lyrics.", code: "TRANSCRIPTION_FAILED" }, 500);
  }
}

servePostApi(handler);
