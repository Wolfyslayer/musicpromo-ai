/**
 * Optional pay-per-use image→video. Groq/OpenAI is used only to *wordsmith* the motion prompt (text).
 * Pixel generation requires fal.ai or Replicate — Groq cannot render video.
 *
 * Secrets (Supabase Edge Functions):
 * - AI_VIDEO_PROVIDER: fal | replicate | off (default off — must be set to fal/replicate to enable paid clips)
 * - FAL_KEY — fal.ai (recommended; default model fal-ai/wan-i2v @ 480p ≈ $0.20/clip)
 * - FAL_VIDEO_MODEL — optional, default fal-ai/wan-i2v
 * - REPLICATE_API_TOKEN + REPLICATE_VIDEO_MODEL (default wavespeedai/wan-2.1-i2v-480p)
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { invokeLlm } from "./invokeLlm.ts";

const BUCKET = "music-promo-assets";
const DEFAULT_FAL_MODEL = "fal-ai/wan-i2v";
const DEFAULT_REPLICATE_MODEL = "wavespeedai/wan-2.1-i2v-480p";

export type AiVideoProvider = "fal" | "replicate" | "off";

export function resolveAiVideoProvider(): AiVideoProvider {
  const mode = (Deno.env.get("AI_VIDEO_PROVIDER") || "").trim().toLowerCase();
  if (!mode || mode === "off" || mode === "none" || mode === "false" || mode === "0") {
    return "off";
  }
  if (mode === "fal" && (Deno.env.get("FAL_KEY") || "").trim()) return "fal";
  if (mode === "replicate" && (Deno.env.get("REPLICATE_API_TOKEN") || "").trim()) {
    return "replicate";
  }
  return "off";
}

export function aiVideoProviderStatus() {
  const provider = resolveAiVideoProvider();
  const paidEnabled = provider === "fal" || provider === "replicate";
  return {
    provider,
    configured: paidEnabled,
    /** When false, the editor hides pay-per-use cloud clip UI (e.g. AI_VIDEO_PROVIDER=off). */
    showPaidClipUi: paidEnabled,
    groqPromptAssist: Boolean(Deno.env.get("OPENAI_API_KEY") || Deno.env.get("AI_API_KEY")),
    falModel: Deno.env.get("FAL_VIDEO_MODEL") || DEFAULT_FAL_MODEL,
    replicateModel: Deno.env.get("REPLICATE_VIDEO_MODEL") || DEFAULT_REPLICATE_MODEL,
    note:
      provider === "fal"
        ? "fal.ai Wan 480p ≈ $0.20 per short clip (pay-as-you-go)."
        : provider === "replicate"
          ? "Replicate Wan 480p ≈ $0.09/sec of output (pay-as-you-go)."
          : "No cloud video API configured — use free cinematic motion in the editor.",
  };
}

export async function expandMotionPromptWithLlm(userPrompt: string, songTitle = ""): Promise<string> {
  const base = String(userPrompt || "").trim() || "Slow cinematic motion from album artwork, music promo.";
  if (!(Deno.env.get("OPENAI_API_KEY") || Deno.env.get("AI_API_KEY"))) return base;
  try {
    const result = (await invokeLlm({
      prompt: `Write ONE image-to-video motion prompt for animating album cover art into a vertical music promo clip.
Rules: under 45 words; describe camera/motion/light only; no on-screen text, logos, subtitles, or UI.
Song title: ${songTitle || "Unknown"}.
Artist note: ${base}`,
      response_json_schema: {
        type: "object",
        properties: { prompt: { type: "string" } },
        required: ["prompt"],
      },
    })) as { prompt?: string };
    return String(result?.prompt || base).trim() || base;
  } catch (err) {
    console.warn("[aiVideoClip] Groq/LLM prompt assist skipped:", (err as Error).message);
    return base;
  }
}

async function falGenerate(imageUrl: string, prompt: string): Promise<{ sourceUrl: string; provider: "fal" }> {
  const key = (Deno.env.get("FAL_KEY") || "").trim();
  if (!key) throw new Error("FAL_KEY is not set.");
  const model = (Deno.env.get("FAL_VIDEO_MODEL") || DEFAULT_FAL_MODEL).trim();

  const createRes = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_url: imageUrl,
      resolution: "480p",
      aspect_ratio: "9:16",
      num_frames: 81,
      frames_per_second: 16,
      enable_safety_checker: true,
    }),
  });
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    throw new Error(`fal.ai error (${createRes.status}): ${created?.detail || JSON.stringify(created)}`);
  }

  const statusUrl = created.status_url || created.statusUrl;
  const responseUrl = created.response_url || created.responseUrl;
  if (!statusUrl || !responseUrl) {
    throw new Error("fal.ai did not return queue URLs.");
  }

  const started = Date.now();
  while (Date.now() - started < 180_000) {
    const stRes = await fetch(statusUrl, { headers: { Authorization: `Key ${key}` } });
    const st = await stRes.json().catch(() => ({}));
    if (st.status === "COMPLETED") break;
    if (st.status === "FAILED") {
      throw new Error(st.error || "fal.ai video generation failed.");
    }
    await new Promise((r) => setTimeout(r, 2500));
  }

  const outRes = await fetch(responseUrl, { headers: { Authorization: `Key ${key}` } });
  const out = await outRes.json().catch(() => ({}));
  const videoUrl = out?.video?.url || out?.data?.video?.url;
  if (!videoUrl) throw new Error("fal.ai returned no video URL.");
  return { sourceUrl: String(videoUrl), provider: "fal" };
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

async function replicateGenerate(imageUrl: string, prompt: string): Promise<{ sourceUrl: string; provider: "replicate" }> {
  const slug = (Deno.env.get("REPLICATE_VIDEO_MODEL") || DEFAULT_REPLICATE_MODEL).trim();
  const prediction = await replicateFetch(`/models/${slug}/predictions`, {
    method: "POST",
    body: JSON.stringify({
      input: {
        image: imageUrl,
        prompt: prompt || "cinematic motion, music promo",
        max_area: "480x832",
        fast_mode: true,
      },
    }),
  });

  const started = Date.now();
  while (Date.now() - started < 180_000) {
    const done = await replicateFetch(`/predictions/${prediction.id}`);
    if (done.status === "succeeded") {
      const out = done.output;
      const url = typeof out === "string" ? out : Array.isArray(out) ? out[0] : out?.url;
      if (url && /^https?:\/\//i.test(String(url))) {
        return { sourceUrl: String(url), provider: "replicate" };
      }
      throw new Error("Replicate returned no video URL.");
    }
    if (done.status === "failed" || done.status === "canceled") {
      throw new Error(done.error || "Replicate video generation failed.");
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error("Replicate video generation timed out.");
}

export async function generateCloudImageToVideo(input: {
  imageUrl: string;
  prompt: string;
  songTitle?: string;
  useLlmPrompt?: boolean;
}): Promise<{
  sourceUrl: string;
  provider: AiVideoProvider;
  motionPrompt: string;
  billingNote: string;
}> {
  const provider = resolveAiVideoProvider();
  if (provider === "off") {
    throw new Error(
      "Cloud AI video is not configured. Use free Cinematic motion in the editor, or set FAL_KEY (recommended) or REPLICATE_API_TOKEN in Supabase secrets. Groq cannot generate video — it only helps write motion prompts."
    );
  }

  const imageUrl = String(input.imageUrl || "").trim();
  if (!/^https:\/\//i.test(imageUrl)) {
    throw new Error("A public HTTPS artwork URL is required.");
  }

  const motionPrompt = input.useLlmPrompt !== false
    ? await expandMotionPromptWithLlm(input.prompt, input.songTitle)
    : input.prompt;

  const result =
    provider === "fal"
      ? await falGenerate(imageUrl, motionPrompt)
      : await replicateGenerate(imageUrl, motionPrompt);

  const billingNote =
    result.provider === "fal"
      ? "Billed by fal.ai (~$0.20 per 480p Wan clip on default model)."
      : "Billed by Replicate (~$0.09/sec for Wan 480p — short clips add up).";

  return { ...result, provider: result.provider, motionPrompt, billingNote };
}

export async function persistAiClipToStorage(
  supabase: SupabaseClient,
  userId: string,
  sourceUrl: string
): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Could not download AI clip (HTTP ${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > 40 * 1024 * 1024) {
    throw new Error("AI clip is too large to store (>40MB).");
  }
  const path = `ai-clips/${userId}/${crypto.randomUUID()}.mp4`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: "video/mp4",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl || "";
  if (!publicUrl) throw new Error("Upload succeeded but public URL is missing.");
  return publicUrl;
}
