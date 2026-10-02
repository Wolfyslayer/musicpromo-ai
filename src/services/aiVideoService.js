import { db } from "@/api/base44Client";

/**
 * Optional pay-per-use cloud image→video (fal.ai or Replicate).
 * Groq (via OPENAI_BASE_URL) only refines the motion *prompt* text — not video pixels.
 */

/** Build-time kill switch (GitHub variable VITE_AI_VIDEO_PROVIDER=off). */
export function paidAiClipUiEnabledFromEnv() {
  const raw = String(
    import.meta.env.VITE_AI_VIDEO_PROVIDER || import.meta.env.VITE_PAID_AI_VIDEO || ""
  )
    .trim()
    .toLowerCase();
  if (!raw || raw === "off" || raw === "none" || raw === "false" || raw === "0") return false;
  return raw === "fal" || raw === "replicate" || raw === "on" || raw === "true" || raw === "1";
}

/** Paid cloud clip UI is opt-in at build time; default hidden on GitHub Pages. */
export function shouldShowPaidAiClipUi(cloudStatus) {
  if (!paidAiClipUiEnabledFromEnv()) return false;
  return cloudStatus?.showPaidClipUi === true;
}

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
