/**
 * Pay-per-use image→video via Replicate (~$0.02–0.08 per short clip on SVD-class models).
 * Set REPLICATE_API_TOKEN in Supabase secrets. Optional REPLICATE_VIDEO_MODEL slug.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_MODEL = "stability-ai/stable-video-diffusion-img2vid-xt";
const BUCKET = "music-promo-assets";

function token(): string {
  const t = (Deno.env.get("REPLICATE_API_TOKEN") || "").trim();
  if (!t) {
    throw new Error(
      "AI video is not configured. Add REPLICATE_API_TOKEN to Supabase Edge Function secrets (see docs/PROMO_VIDEO.md)."
    );
  }
  return t;
}

function modelSlug(): string {
  return (Deno.env.get("REPLICATE_VIDEO_MODEL") || DEFAULT_MODEL).trim();
}

async function replicateFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.replicate.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.detail || body?.error || JSON.stringify(body);
    throw new Error(`Replicate error (${res.status}): ${detail}`);
  }
  return body;
}

async function waitForPrediction(id: string, maxMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const prediction = await replicateFetch(`/predictions/${id}`);
    if (prediction.status === "succeeded") return prediction;
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(prediction.error || "AI video generation failed.");
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error("AI video generation timed out. Try again — Replicate may still be processing.");
}

function firstOutputUrl(output: unknown): string {
  if (typeof output === "string" && /^https?:\/\//i.test(output)) return output;
  if (Array.isArray(output) && output.length) {
    const first = output[0];
    if (typeof first === "string" && /^https?:\/\//i.test(first)) return first;
  }
  throw new Error("Replicate returned no video URL.");
}

export async function generateReplicateImageToVideo(input: {
  imageUrl: string;
  prompt?: string;
}): Promise<{ replicateUrl: string; predictionId: string }> {
  const imageUrl = String(input.imageUrl || "").trim();
  if (!/^https:\/\//i.test(imageUrl)) {
    throw new Error("A public HTTPS artwork URL is required for AI video.");
  }
  const slug = modelSlug();
  const prediction = await replicateFetch(`/models/${slug}/predictions`, {
    method: "POST",
    body: JSON.stringify({
      input: {
        input_image: imageUrl,
        motion_bucket_id: 127,
        fps: 6,
        cond_aug: 0.02,
        decoding_t: 7,
        video_length: "25_frames_with_svd_xt",
        sizing_strategy: "maintain_aspect_ratio",
      },
    }),
  });

  const done = await waitForPrediction(String(prediction.id));
  const replicateUrl = firstOutputUrl(done.output);
  return { replicateUrl, predictionId: String(done.id) };
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
