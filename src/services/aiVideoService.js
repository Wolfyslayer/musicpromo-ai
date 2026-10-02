import { db } from "@/api/base44Client";

/**
 * Optional pay-per-use cloud image→video (fal.ai or Replicate).
 * Groq (via OPENAI_BASE_URL) only refines the motion *prompt* text — not video pixels.
 */
export async function fetchAiVideoStatus() {
  const res = await db.functions.invoke("generateAiVideoClip", { action: "status" });
  return res.data;
}

export async function generateAiVideoClip({
  imageUrl,
  prompt,
  projectId,
  songTitle,
  useLlmPrompt = true,
}) {
  const res = await db.functions.invoke("generateAiVideoClip", {
    imageUrl,
    prompt,
    projectId,
    songTitle,
    useLlmPrompt,
  });
  return res.data;
}
