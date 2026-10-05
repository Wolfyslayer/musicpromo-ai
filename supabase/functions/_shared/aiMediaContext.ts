import { fetchMediaBytes } from "./mediaFetch.ts";

export type AiMediaPlanItem = {
  kind: "image" | "audio";
  label: string;
  url: string;
};

export type AiMediaHints = {
  hasArtwork: boolean;
  audioTrackCount: number;
  releaseTitle?: string;
};

type TrackRow = {
  title?: string;
  audio_url?: string;
  audioUrl?: string;
};

function maxAudioTracks(): number {
  const raw = Deno.env.get("GEMINI_MAX_CAMPAIGN_AUDIO_TRACKS");
  const n = raw ? Number(raw) : 3;
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 5) : 3;
}

function pickUrl(...candidates: unknown[]): string {
  for (const c of candidates) {
    const s = String(c || "").trim();
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
  }
  return "";
}

/** Build artwork + audio attachments from analyze/campaign song payload. */
export function planMediaAttachments(body: Record<string, unknown>): {
  items: AiMediaPlanItem[];
  hints: AiMediaHints;
} {
  const items: AiMediaPlanItem[] = [];
  const artwork = pickUrl(body.artwork_url, body.artworkUrl);
  if (artwork) {
    items.push({ kind: "image", label: "Release artwork", url: artwork });
  }

  const tracks = body.tracks as TrackRow[] | undefined;
  const releaseTitle = String(body.release_title || body.releaseTitle || "").trim();
  let audioCount = 0;

  if (Array.isArray(tracks) && tracks.length) {
    const limit = maxAudioTracks();
    for (const t of tracks) {
      if (audioCount >= limit) break;
      const audio = pickUrl(t.audio_url, t.audioUrl);
      if (!audio) continue;
      const title = String(t.title || "Track").trim();
      items.push({ kind: "audio", label: `Audio — ${title}`, url: audio });
      audioCount += 1;
    }
  } else {
    const audio = pickUrl(body.audio_url, body.audioUrl);
    if (audio) {
      const title = String(body.title || "Song").trim();
      items.push({ kind: "audio", label: `Audio — ${title}`, url: audio });
      audioCount = 1;
    }
  }

  return {
    items,
    hints: {
      hasArtwork: Boolean(artwork),
      audioTrackCount: audioCount,
      releaseTitle: releaseTitle || undefined,
    },
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export type GeminiInlinePart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

/** Download planned media; skips failed fetches with a warning. */
export async function buildGeminiInlineParts(
  items: AiMediaPlanItem[]
): Promise<{ parts: GeminiInlinePart[]; loaded: AiMediaPlanItem[] }> {
  const parts: GeminiInlinePart[] = [];
  const loaded: AiMediaPlanItem[] = [];

  for (const item of items) {
    try {
      const { bytes, mimeType } = await fetchMediaBytes(item.url, item.kind);
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: bytesToBase64(bytes),
        },
      });
      parts.push({ text: `[Attached ${item.kind}: ${item.label}]` });
      loaded.push(item);
    } catch (err) {
      console.warn("[aiMediaContext] skip media:", item.label, (err as Error).message);
    }
  }

  return { parts, loaded };
}

export function buildMultimodalPromptPrefix(hints: AiMediaHints): string {
  if (!hints.hasArtwork && !hints.audioTrackCount) return "";
  const lines = [
    "MULTIMODAL INPUT",
    "You are given the release artwork and/or audio clip(s) attached below (in addition to the text metadata).",
    "- Base genre, mood, energy, hooks, visual angles, and content opportunities on what you SEE in the artwork and HEAR in the audio.",
    "- Reference specific visual motifs (colors, mood, typography style, symbolism) from the artwork in promotionalAngles and contentOpportunities.",
    "- Reference tempo, instrumentation, vocal delivery, and hook moments you hear in the audio for hookSections and contentOpportunities.",
  ];
  if (hints.audioTrackCount > 1) {
    lines.push(
      `- This release has ${hints.audioTrackCount} audio clips attached — treat it as a multi-track release; mention track titles when suggesting hooks.`
    );
  }
  if (hints.releaseTitle) {
    lines.push(`Release title: ${hints.releaseTitle}`);
  }
  return `${lines.join("\n")}\n\n`;
}
