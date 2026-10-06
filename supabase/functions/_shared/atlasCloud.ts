/**
 * Atlas Cloud unified API (https://atlascloud.ai/docs).
 * - Chat: https://api.atlascloud.ai/v1/chat/completions (OpenAI-compatible)
 * - Video / image: https://api.atlascloud.ai/api/v1/model/*
 */

const ATLAS_CHAT_BASE = "https://api.atlascloud.ai/v1";
const ATLAS_API_BASE = "https://api.atlascloud.ai/api/v1";

export function resolveAtlasApiKey(): string {
  return String(Deno.env.get("ATLASCLOUD_API_KEY") || Deno.env.get("ATLAS_CLOUD_API_KEY") || "").trim();
}

export function hasAtlasConfigured(): boolean {
  return Boolean(resolveAtlasApiKey());
}

export function resolveAtlasChatModel(): string {
  return (
    (Deno.env.get("ATLAS_CHAT_MODEL") || Deno.env.get("ATLAS_LLM_MODEL") || "deepseek-v3").trim() ||
    "deepseek-v3"
  );
}

export function resolveAtlasWanI2vModel(): string {
  return (
    (Deno.env.get("ATLAS_WAN_I2V_MODEL") || "alibaba/wan-3.0/image-to-video").trim() ||
    "alibaba/wan-3.0/image-to-video"
  );
}

export type AtlasPredictionStatus = "processing" | "completed" | "failed" | string;

export async function atlasGenerateVideo(args: {
  prompt: string;
  imageUrl: string;
  durationSec?: number;
  resolution?: string;
  audio?: boolean;
}): Promise<{ outputUrl: string; predictionId: string; durationSec: number }> {
  const key = resolveAtlasApiKey();
  if (!key) throw new Error("Set ATLASCLOUD_API_KEY in Supabase Edge Function secrets.");

  const duration = Math.min(30, Math.max(2, Math.floor(Number(args.durationSec) || 5)));
  const resolution = String(args.resolution || Deno.env.get("ATLAS_WAN_RESOLUTION") || "720p");
  const model = resolveAtlasWanI2vModel();

  const createRes = await fetch(`${ATLAS_API_BASE}/model/generateVideo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: String(args.prompt || "").slice(0, 20_000) || "Cinematic motion from album artwork, vertical music promo.",
      image: args.imageUrl,
      resolution,
      duration,
      audio: args.audio !== false,
    }),
  });

  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    throw new Error(`Atlas video error (${createRes.status}): ${JSON.stringify(created).slice(0, 400)}`);
  }

  const predictionId = created?.data?.id || created?.data?.prediction_id || created?.id;
  if (!predictionId) throw new Error("Atlas did not return a prediction id.");

  const started = Date.now();
  while (Date.now() - started < 300_000) {
    const pollRes = await fetch(`${ATLAS_API_BASE}/model/prediction/${predictionId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const poll = await pollRes.json().catch(() => ({}));
    const status = poll?.data?.status as AtlasPredictionStatus;
    if (status === "completed") {
      const outputs = poll?.data?.outputs;
      const url = Array.isArray(outputs) ? outputs[0] : outputs;
      if (!url || typeof url !== "string") throw new Error("Atlas completed without a video URL.");
      return { outputUrl: url, predictionId: String(predictionId), durationSec: duration };
    }
    if (status === "failed") {
      throw new Error(poll?.data?.error || "Atlas video generation failed.");
    }
    await new Promise((r) => setTimeout(r, 4000));
  }

  throw new Error("Atlas video generation timed out.");
}

export function atlasChatCompletionsUrl(): string {
  return `${ATLAS_CHAT_BASE}/chat/completions`;
}
