/**
 * Text → album cover image.
 *
 * Default: Google Gemini image models (GEMINI_API_KEY from AI Studio).
 *
 * Legacy:
 * - OPENAI_IMAGE_* — OpenAI Images (DALL·E / gpt-image)
 * - FAL_KEY, REPLICATE_API_TOKEN — AI_COVER_PROVIDER=fal|replicate
 * - AI_COVER_PROVIDER — gemini | openai | fal | replicate | off
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { hasLlmConfigured, resolveGeminiApiKey } from "./aiProvider.ts";
import { geminiGenerateImage, resolveGeminiImageModel } from "./geminiImages.ts";
import { invokeLlm } from "./invokeLlm.ts";

const BUCKET = "music-promo-assets";
const DEFAULT_FAL_COVER = "fal-ai/flux/dev";
const DEFAULT_REPLICATE_COVER = "black-forest-labs/flux-schnell";
const DEFAULT_OPENAI_IMAGE_MODEL = "dall-e-3";
const DEFAULT_OPENAI_IMAGE_EDIT_MODEL = "gpt-image-1";
const DEFAULT_OPENAI_IMAGE_SIZE = "1024x1024";

export type CoverArtProvider = "gemini" | "openai" | "fal" | "replicate" | "off";

function openAiImageApiKey(): string {
  return (Deno.env.get("OPENAI_IMAGE_API_KEY") || Deno.env.get("OPENAI_API_KEY") || Deno.env.get("AI_API_KEY") || "")
    .trim();
}

function openAiImageApiBase(): string {
  const base = Deno.env.get("OPENAI_IMAGE_BASE_URL") || "https://api.openai.com/v1";
  return base.replace(/\/+$/, "");
}

export function resolveCoverArtProvider(): CoverArtProvider {
  const mode = (Deno.env.get("AI_COVER_PROVIDER") || "").trim().toLowerCase();
  const geminiKey = resolveGeminiApiKey();
  const openaiKey = openAiImageApiKey();
  const falKey = (Deno.env.get("FAL_KEY") || "").trim();
  const repToken = (Deno.env.get("REPLICATE_API_TOKEN") || "").trim();

  if (mode === "off" || mode === "none" || mode === "false" || mode === "0") {
    return "off";
  }
  if (mode === "gemini") return geminiKey ? "gemini" : "off";
  if (mode === "openai") return openaiKey ? "openai" : "off";
  if (mode === "fal") return falKey ? "fal" : "off";
  if (mode === "replicate") return repToken ? "replicate" : "off";

  if (geminiKey) return "gemini";
  if (openaiKey) return "openai";
  if (falKey) return "fal";
  if (repToken) return "replicate";
  return "off";
}

export function coverArtProviderStatus() {
  const provider = resolveCoverArtProvider();
  return {
    provider,
    configured: provider !== "off",
    supportsImageEdit: provider === "gemini" || provider === "openai",
    geminiImageModel: resolveGeminiImageModel(),
    openAiImageModel: Deno.env.get("OPENAI_IMAGE_MODEL") || DEFAULT_OPENAI_IMAGE_MODEL,
    openAiImageEditModel: Deno.env.get("OPENAI_IMAGE_EDIT_MODEL") || DEFAULT_OPENAI_IMAGE_EDIT_MODEL,
    falModel: Deno.env.get("FAL_COVER_MODEL") || DEFAULT_FAL_COVER,
    replicateModel: Deno.env.get("REPLICATE_COVER_MODEL") || DEFAULT_REPLICATE_COVER,
    note:
      provider === "gemini"
        ? "Cover art via Gemini (Google AI Studio free tier limits apply)."
        : provider === "openai"
          ? "Cover art billed by OpenAI (Images API — pay-as-you-go)."
          : provider === "fal"
            ? "Cover art billed by fal.ai (Flux — pay-as-you-go)."
            : provider === "replicate"
              ? "Cover art billed by Replicate (Flux Schnell)."
              : "Set GEMINI_API_KEY in Supabase Edge Function secrets to enable AI covers.",
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

  if (!hasLlmConfigured()) {
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

export async function expandCoverEditPromptWithLlm(input: {
  prompt: string;
  title?: string;
  artistName?: string;
  genre?: string;
  mood?: string;
}): Promise<string> {
  const instruction = String(input.prompt || "").trim();
  if (!instruction) {
    throw new Error("Describe what to change (e.g. “make the sky purple” or “add neon rain”).");
  }

  const context = [
    input.title ? `Album title (for mood only, do not render as text): ${input.title}.` : "",
    input.artistName ? `Artist: ${input.artistName}.` : "",
    input.genre ? `Genre: ${input.genre}.` : "",
    input.mood ? `Mood: ${input.mood}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const base = `Image 1: square music album cover artwork. Apply this edit: ${instruction}. ${context} Preserve the overall composition unless the edit requires a big change. Do not add on-image text, logos, or watermarks unless the user explicitly asked for text.`;

  if (!hasLlmConfigured()) return base;

  try {
    const result = (await invokeLlm({
      prompt: `Rewrite as ONE clear instruction for an image-editing model (Image 1 = uploaded album cover).
User edit request: ${instruction}
${context}
Output only the final edit instruction, one paragraph.`,
      response_json_schema: {
        type: "object",
        properties: { prompt: { type: "string" } },
        required: ["prompt"],
      },
    })) as { prompt?: string };
    const out = String(result?.prompt || base).trim();
    return out.startsWith("Image 1") ? out : `Image 1: square album cover. ${out}`;
  } catch (err) {
    console.warn("[aiCoverArt] edit prompt assist skipped:", (err as Error).message);
    return base;
  }
}

function decodeBase64Image(b64: string): Uint8Array {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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

async function openAiTextToImage(prompt: string): Promise<{ sourceUrl: string; provider: "openai" }> {
  const apiKey = openAiImageApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY (or OPENAI_IMAGE_API_KEY) is not set.");
  }

  const model = (Deno.env.get("OPENAI_IMAGE_MODEL") || DEFAULT_OPENAI_IMAGE_MODEL).trim();
  const size = (Deno.env.get("OPENAI_IMAGE_SIZE") || DEFAULT_OPENAI_IMAGE_SIZE).trim();
  const quality = (Deno.env.get("OPENAI_IMAGE_QUALITY") || "standard").trim();

  const body: Record<string, unknown> = {
    model,
    prompt: prompt.slice(0, 4000),
    n: 1,
    size,
    response_format: "url",
  };
  if (model.startsWith("dall-e-3")) {
    body.quality = quality === "hd" ? "hd" : "standard";
  }

  const res = await fetch(`${openAiImageApiBase()}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || JSON.stringify(data);
    throw new Error(`OpenAI Images error (${res.status}): ${msg}`);
  }

  const imageUrl = data?.data?.[0]?.url;
  if (!imageUrl || !/^https?:\/\//i.test(String(imageUrl))) {
    throw new Error("OpenAI returned no image URL.");
  }
  return { sourceUrl: String(imageUrl), provider: "openai" };
}

type OpenAiImageResult = {
  sourceUrl?: string;
  imageBytes?: Uint8Array;
  provider: "openai";
};

async function openAiEditImage(prompt: string, imagePng: Uint8Array): Promise<OpenAiImageResult> {
  const apiKey = openAiImageApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY (or OPENAI_IMAGE_API_KEY) is not set.");
  }
  if (imagePng.byteLength > 12 * 1024 * 1024) {
    throw new Error("Reference image is too large after processing (max 12 MB).");
  }

  const editModel = (Deno.env.get("OPENAI_IMAGE_EDIT_MODEL") || DEFAULT_OPENAI_IMAGE_EDIT_MODEL).trim();
  const form = new FormData();
  form.append("model", editModel);
  form.append("prompt", prompt.slice(0, 4000));
  form.append("image", new Blob([imagePng], { type: "image/png" }), "cover.png");
  form.append("size", "1024x1024");
  form.append("output_format", "png");

  if (editModel.startsWith("gpt-image") || editModel.includes("chatgpt-image")) {
    form.append("quality", (Deno.env.get("OPENAI_IMAGE_EDIT_QUALITY") || "medium").trim());
    form.append("input_fidelity", (Deno.env.get("OPENAI_IMAGE_INPUT_FIDELITY") || "high").trim());
  } else if (editModel.startsWith("dall-e-2")) {
    form.append("response_format", "url");
  }

  const res = await fetch(`${openAiImageApiBase()}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || JSON.stringify(data);
    throw new Error(`OpenAI image edit error (${res.status}): ${msg}`);
  }

  const item = data?.data?.[0];
  const url = item?.url;
  if (url && /^https?:\/\//i.test(String(url))) {
    return { sourceUrl: String(url), provider: "openai" };
  }
  const b64 = item?.b64_json;
  if (b64) {
    return { imageBytes: decodeBase64Image(String(b64)), provider: "openai" };
  }
  throw new Error("OpenAI edit returned no image.");
}

export async function generateCloudCoverArt(input: {
  prompt: string;
  title?: string;
  artistName?: string;
  genre?: string;
  mood?: string;
  useLlmPrompt?: boolean;
  referenceImageBytes?: Uint8Array;
}): Promise<{
  sourceUrl?: string;
  imageBytes?: Uint8Array;
  provider: CoverArtProvider;
  imagePrompt: string;
  billingNote: string;
  mode: "generate" | "edit";
}> {
  const provider = resolveCoverArtProvider();
  if (provider === "off") {
    throw new Error("AI cover art is not configured. Set GEMINI_API_KEY in Supabase Edge Function secrets.");
  }

  const hasReference = Boolean(input.referenceImageBytes?.byteLength);

  if (hasReference) {
    const imagePrompt =
      input.useLlmPrompt !== false
        ? await expandCoverEditPromptWithLlm(input)
        : `Image 1: album cover. ${String(input.prompt || "").trim()}`;

    if (provider === "gemini") {
      const gemini = await geminiGenerateImage({
        prompt: imagePrompt,
        referenceImageBytes: input.referenceImageBytes,
      });
      return {
        imageBytes: gemini.imageBytes,
        provider: "gemini",
        imagePrompt,
        billingNote: "Edited with Gemini (Google AI Studio).",
        mode: "edit",
      };
    }
    if (provider === "openai") {
      const edited = await openAiEditImage(imagePrompt, input.referenceImageBytes!);
      return {
        ...edited,
        provider: "openai",
        imagePrompt,
        billingNote: "Billed by OpenAI (image edit with your upload).",
        mode: "edit",
      };
    }
    throw new Error("Upload-and-edit requires Gemini or OpenAI Images (not fal/Replicate-only).");
  }

  const imagePrompt =
    input.useLlmPrompt !== false
      ? await expandCoverPromptWithLlm(input)
      : String(input.prompt || "").trim() ||
        "Square album cover artwork, cinematic, no text, no logos, music release.";

  if (provider === "gemini") {
    const gemini = await geminiGenerateImage({ prompt: imagePrompt });
    return {
      imageBytes: gemini.imageBytes,
      provider: "gemini",
      imagePrompt,
      billingNote: "Generated with Gemini (Google AI Studio).",
      mode: "generate",
    };
  }

  const result =
    provider === "openai"
      ? await openAiTextToImage(imagePrompt)
      : provider === "fal"
        ? await falTextToImage(imagePrompt)
        : await replicateTextToImage(imagePrompt);

  const billingNote =
    result.provider === "openai"
      ? "Billed by OpenAI (DALL·E / Images API)."
      : result.provider === "fal"
        ? "Billed by fal.ai (Flux image — pay-as-you-go)."
        : "Billed by Replicate (Flux Schnell image).";

  return { ...result, provider: result.provider, imagePrompt, billingNote, mode: "generate" };
}

export async function persistCoverArtFromBytes(
  supabase: SupabaseClient,
  userId: string,
  bytes: Uint8Array,
  contentType = "image/png"
): Promise<string> {
  if (bytes.byteLength > 15 * 1024 * 1024) {
    throw new Error("Cover image is too large to store (>15MB).");
  }
  const ext = contentType.includes("jpeg") ? "jpg" : "png";
  const path = `cover-art/${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl || "";
  if (!publicUrl) throw new Error("Upload succeeded but public URL is missing.");
  return publicUrl;
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
