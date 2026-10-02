import { db } from "@/api/base44Client";

/**
 * Pay-per-use AI motion clip from album art (Replicate image→video).
 * Requires REPLICATE_API_TOKEN on Supabase. Clip is copied into your promo bucket for editing.
 */
export async function generateAiVideoClip({ imageUrl, prompt, projectId }) {
  const res = await db.functions.invoke("generateAiVideoClip", {
    imageUrl,
    prompt,
    projectId,
  });
  return res.data;
}
