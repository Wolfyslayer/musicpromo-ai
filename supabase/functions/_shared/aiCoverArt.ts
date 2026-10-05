/**
 * Text → album cover image (optional pay-per-use).
 *
 * Secrets:
 * - FAL_KEY — fal.ai (recommended; e.g. fal-ai/flux/dev)
 * - FAL_COVER_MODEL — optional, default fal-ai/flux/dev
 * - REPLICATE_API_TOKEN + REPLICATE_COVER_MODEL (default black-forest-labs/flux-schnell)
 * - OPENAI_API_KEY — optional prompt polish (Groq-compatible base URL OK)
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { invokeLlm } from "./invokeLlm.ts";

const BUCKET = "music-promo-assets";
const DEFAULT_FAL_COVER = "fal-ai/flux/dev";
const DEFAULT_REPLICATE_COVER = "black-forest-labs/flux-schnell";

export type CoverArtProvider = "fal" | "replicate" | "off";

export function resolveCoverArtProvider(): CoverArtProvider {
  const mode = (Deno.env.get("AI_COVER_PROVIDER") || Deno.env.get("AI_VIDEO_PROVIDER") || "").trim().toLowerCase();
  const falKey = (Deno.env.get("FAL_KEY") || "").trim();
  const repToken = (Deno.env.get("REPLICATE_API_TOKEN") || "").trim();
  if (mode === "off" || mode === "none" || mode === "false" || mode === "0") {
    if (falKey) return "fal";
    if (repToken) return "replicate";
    return "off";
  }
  if ((mode === "fal" || !mode) && falKey) return "fal";
  if (mode === "replicate" && repToken) return "replicate";
  if (falKey) return "fal";
  if (repToken) return "replicate";
  return "off";
}

export function coverArtProviderStatus() {
  const provider = resolveCoverArtProvider();
  return {
    provider,
    configured: provider !== "off",
    falModel: Deno.env.get("FAL_COVER_MODEL") || DEFAULT_FAL_COVER,
    replicateModel: Deno.env.get("REPLICATE_COVER_MODEL") || DEFAULT_REPLICATE_COVER,
    note:
      provider === "fal"
        ? "Cover art billed by fal.ai (Flux — pay-as-you-go)."
        : provider === "replicate"
          ? "Cover art billed by Replicate (Flux Schnell)."
          : "Set FAL_KEY or REPLICATE_API_TOKEN in Supabase secrets to enable AI covers.",
  };
}

export async function expandCoverPromptWithLlm(input: {
  prompt: string;
  title?: string;
  artistName?: string;
  genre?: string;
  mood?: string;
}): Promise<string> {
  const seed = String(input.prompt || "").trim();
  const base = [
    seed,
    input.title ? `Album title: ${input.title}.` : "",
    input.artistName ? `Artist: ${input.artistName}.` : "",
    input.genre ? `Genre: ${input.genre}.` : "",
    input.mood ? `Mood: ${input.mood}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!(Deno.env.get("OPENAI_API_KEY") || Deno.env.get("AI_API_KEY"))) {
    return base || "Square album cover art, cinematic lighting, no text, no logos, music release artwork.";
  }

  try {
    const result = (await invokeLlm({
      prompt: `Write ONE detailed image generation prompt for a square MUSIC ALBUM COVER (3000×3000 style).
Rules: no on-image text, titles, logos, or watermarks; strong composition; print-ready; describe visuals only.
${base}`,
      response_json_schema: {
        type: "object",
        properties: { prompt: { type: "string" } },
        required: ["prompt"],
      },
    })) as { prompt?: string };
    return String(result?.prompt || base).trim() || base;
  } catch (err) {
    console.warn("[aiCoverArt] LLM prompt assist skipped:", (err as Error).message);
    return base || "Square album cover art, cinematic lighting, no text, no logos.";
  }
}

async function falTextToImage(prompt: string): Promise<{ sourceUrl: string; provider: "fal" }> {
  const key = (Deno.env.get("FAL_KEY") || "").trim();
  if (!key) throw new Error("FAL_KEY is not set.");
  const model = (Deno.env.get("FAL_COVER_MODEL") || DEFAULT_FAL_COVER).trim();

  const createRes = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      image_size: "square_hd",
      num_inference_steps: 28,
      enable_safety_checker: true,
    }),
  });
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    throw new Error(`fal.ai error (${createRes.status}): ${created?.detail || JSON.stringify(created)}`);
  }

  const statusUrl = created.status_url || created.statusUrl;
  const responseUrl = created.response_url || created.responseUrl;
  if (!statusUrl || !responseUrl) throw new Error("fal.ai did not return queue URLs.");

  const started = Date.now();
  while (Date.now() - started < 120_000) {
    const stRes = await fetch(statusUrl, { headers: { Authorization: `Key ${key}` } });
    const st = await stRes.json().catch(() => ({}));
    if (st.status === "COMPLETED") break;
    if (st.status === "FAILED") throw new Error(st.error || "fal.ai cover generation failed.");
    await new Promise((r) => setTimeout(r, 2000));
  }

  const outRes = await fetch(responseUrl, { headers: { Authorization: `Key ${key}` } });
  const out = await outRes.json().catch(() => ({}));
  const imageUrl =
    out?.images?.[0]?.url || out?.image?.url || out?.data?.images?.[0]?.url || out?.data?.image?.url;
  if (!imageUrl) throw new Error("fal.ai returned no image URL.");
  return { sourceUrl: String(imageUrl), provider: "fal" };
}

async function replicateFetch(path: string, init: RequestInit = {}) {
  const token = (Deno.env.get("REPLICATE_API_TOKEN") || "").trim();
  if (!token) throw new Error("REPLICATE_API_TOKEN is not set.");
  const res = await fetch(`https://api.replicate.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Replicate error (${res.status}): ${body?.detail || body?.error || JSON.stringify(body)}`);
  }
  return body;
}

async function replicateTextToImage(prompt: string): Promise<{ sourceUrl: string; provider: "replicate" }> {
  const slug = (Deno.env.get("REPLICATE_COVER_MODEL") || DEFAULT_REPLICATE_COVER).trim();
  const prediction = await replicateFetch(`/models/${slug}/predictions`, {
    method: "POST",
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: "1:1",
        output_format: "png",
      },
    }),
  });

  const started = Date.now();
  while (Date.now() - started < 120_000) {
    const done = await replicateFetch(`/predictions/${prediction.id}`);
    if (done.status === "succeeded") {
      const out = done.output;
      const url = typeof out === "string" ? out : Array.isArray(out) ? out[0] : out?.url;
      if (url && /^https?:\/\//i.test(String(url))) {
        return { sourceUrl: String(url), provider: "replicate" };
      }
      throw new Error("Replicate returned no image URL.");
    }
    if (done.status === "failed" || done.status === "canceled") {
      throw new Error(done.error || "Replicate cover generation failed.");
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Replicate cover generation timed out.");
}

export async function generateCloudCoverArt(input: {
  prompt: string;
  title?: string;
  artistName?: string;
  genre?: string;
  mood?: string;
  useLlmPrompt?: boolean;
}): Promise<{ sourceUrl: string; provider: CoverArtProvider; imagePrompt: string; billingNote: string }> {
  const provider = resolveCoverArtProvider();
  if (provider === "off") {
    throw new Error(
      "AI cover art is not configured. Set FAL_KEY (recommended) or REPLICATE_API_TOKEN in Supabase Edge Function secrets."
    );
  }

  const imagePrompt =
    input.useLlmPrompt !== false
      ? await expandCoverPromptWithLlm(input)
      : String(input.prompt || "").trim() ||
        "Square album cover artwork, cinematic, no text, no logos, music release.";

  const result = provider === "fal" ? await falTextToImage(imagePrompt) : await replicateTextToImage(imagePrompt);

  const billingNote =
    result.provider === "fal"
      ? "Billed by fal.ai (Flux image — pay-as-you-go)."
      : "Billed by Replicate (Flux Schnell image).";

  return { ...result, provider: result.provider, imagePrompt, billingNote };
}

export async function persistCoverArtToStorage(
  supabase: SupabaseClient,
  userId: string,
  sourceUrl: string
): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Could not download cover image (HTTP ${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > 15 * 1024 * 1024) {
    throw new Error("Cover image is too large to store (>15MB).");
  }
  const path = `cover-art/${userId}/${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: "image/png",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl || "";
  if (!publicUrl) throw new Error("Upload succeeded but public URL is missing.");
  return publicUrl;
}
