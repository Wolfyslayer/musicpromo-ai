/**
 * AI song generation — TemPolor Open Platform (default) or legacy Suno-compatible gateway.
 * Secrets: SUNO_API_KEY, SUNO_API_BASE_URL (default https://api.tempolor.com), optional SUNO_API_MODEL.
 * TemPolor also requires PUBLIC_APP_URL for callback_url (see tempolorSongCallback).
 */

import {
  isTempolorPlatform,
  readTempolorConfig,
  tempolorCallbackUrl,
  tempolorRequest,
  TEMPOLOR_POLL_MS,
  TEMPOLOR_POLL_TIMEOUT_MS,
} from "./tempolorApi.ts";
import { normalizeApiKey, normalizeExternalBaseUrl } from "./externalUrl.ts";

type SunoGenerateInput = {
  prompt: string;
  lyrics?: string;
  title?: string;
  instrumental?: boolean;
};

type SunoGenerateResult = { audioUrl: string; taskId?: string; raw?: unknown };

function readConfig() {
  const cfg = readTempolorConfig();
  const model = (Deno.env.get("SUNO_API_MODEL") || "tempolor-latest").trim();
  return { ...cfg, model };
}

export function sunoProviderStatus() {
  const { key, base, model, publicApp, legacy } = readConfig();
  const tempolor = isTempolorPlatform(base, legacy);
  const configured = Boolean(key && (tempolor ? publicApp : base));
  return {
    configured,
    provider: configured ? (tempolor ? "tempolor" : "suno_gateway") : "off",
    model: tempolor ? model : undefined,
    note: !key
      ? "Set SUNO_API_KEY (TemPolor API key) and SUNO_API_BASE_URL for Creator+ subscribers."
      : tempolor && !publicApp
        ? "Set PUBLIC_APP_URL (TemPolor requires callback_url) plus SUNO_API_KEY."
        : tempolor
          ? "Song generation uses TemPolor (SUNO_API_* secrets) — async generate + poll."
          : "Song generation uses SUNO_API_BASE_URL + SUNO_API_KEY (legacy /generate gateway).",
  };
}

function buildTempolorPrompt(input: SunoGenerateInput): string {
  const prompt = String(input.prompt || "").trim();
  const title = String(input.title || "").trim();
  if (!title) return prompt;
  if (!prompt) return title;
  if (prompt.toLowerCase().includes(title.toLowerCase())) return prompt;
  return `${title} — ${prompt}`;
}

async function pollTempolorSong(
  base: string,
  key: string,
  itemId: string
): Promise<SunoGenerateResult> {
  const deadline = Date.now() + TEMPOLOR_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const data = await tempolorRequest<{
      data?: { songs?: Record<string, unknown>[] };
    }>(base, key, "/open-apis/v1/song/query", { item_ids: [itemId] });

    const song = data?.data?.songs?.[0];
    if (!song) {
      await new Promise((r) => setTimeout(r, TEMPOLOR_POLL_MS));
      continue;
    }

    const status = String(song.status || "");
    if (status === "failed" || status === "part_failed") {
      throw new Error("TemPolor could not generate this song. Try a different prompt.");
    }

    const audioUrl = String(song.audio_url || song.streamAudioUrl || "").trim();
    if (
      audioUrl &&
      (status === "succeeded" || status === "main_succeeded" || status === "running")
    ) {
      return {
        audioUrl,
        taskId: itemId,
        raw: song,
      };
    }

    await new Promise((r) => setTimeout(r, TEMPOLOR_POLL_MS));
  }
  throw new Error("Song generation timed out — TemPolor may still be processing. Try again shortly.");
}

async function generateViaTempolor(input: SunoGenerateInput): Promise<SunoGenerateResult> {
  const { key, base, model, publicApp } = readConfig();
  if (!key) {
    throw new Error("Song API is not configured (SUNO_API_KEY).");
  }

  const prompt = buildTempolorPrompt(input);
  if (!prompt) throw new Error("prompt is required");

  const started = await tempolorRequest<{ data?: { item_ids?: string[] } }>(
    base,
    key,
    "/open-apis/v1/song/generate",
    {
      model,
      prompt,
      lyrics: String(input.lyrics || ""),
      callback_url: tempolorCallbackUrl(publicApp),
      instrumental: Boolean(input.instrumental),
    }
  );

  const itemId = started?.data?.item_ids?.[0];
  if (!itemId) {
    throw new Error("TemPolor did not return item_ids. Check API credits and model name.");
  }

  return pollTempolorSong(base, key, String(itemId));
}

async function generateViaLegacyGateway(input: SunoGenerateInput): Promise<SunoGenerateResult> {
  const key = normalizeApiKey(Deno.env.get("SUNO_API_KEY") || "");
  const base = normalizeExternalBaseUrl(Deno.env.get("SUNO_API_BASE_URL") || "", "");
  if (!base || !key) {
    throw new Error("Suno API is not configured (SUNO_API_BASE_URL, SUNO_API_KEY).");
  }

  const res = await fetch(`${base}/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: input.prompt,
      lyrics: input.lyrics || "",
      title: input.title || "",
      make_instrumental: Boolean(input.instrumental),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Suno API error (${res.status})`);
  }

  const audioUrl =
    data?.audio_url ||
    data?.audioUrl ||
    data?.data?.[0]?.audio_url ||
    data?.data?.[0]?.audioUrl ||
    "";
  if (!audioUrl) {
    throw new Error("Gateway did not return audio_url. Check SUNO_API_LEGACY / response shape.");
  }

  return {
    audioUrl: String(audioUrl),
    taskId: data?.id || data?.task_id,
    raw: data,
  };
}

export async function generateSunoTrack(input: SunoGenerateInput): Promise<SunoGenerateResult> {
  const cfg = readConfig();
  if (isTempolorPlatform(cfg.base, cfg.legacy)) {
    return generateViaTempolor(input);
  }
  return generateViaLegacyGateway(input);
}
