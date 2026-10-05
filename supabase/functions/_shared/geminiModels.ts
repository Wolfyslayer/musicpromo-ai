/**
 * Per-feature Gemini model IDs (Supabase Edge Function secrets).
 * Each slot falls back to GEMINI_MODEL, then the code default for that slot.
 */

/** Default chat when GEMINI_MODEL is unset. */
export const DEFAULT_GEMINI_CHAT_MODEL = "gemini-3.8-flash";

/** Nano Banana 2 — recommended default for cover / artwork generation. */
export const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";

/** Legacy Nano Banana (2.5 Flash Image). */
export const LEGACY_GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

export type GeminiChatModelSlot =
  | "default"
  | "analyze_song"
  | "generate_campaign"
  | "generate_content"
  | "support_chat"
  | "cover_prompt"
  | "video_prompt";

const SLOT_SECRET: Record<Exclude<GeminiChatModelSlot, "default">, string> = {
  analyze_song: "GEMINI_MODEL_ANALYZE_SONG",
  generate_campaign: "GEMINI_MODEL_GENERATE_CAMPAIGN",
  generate_content: "GEMINI_MODEL_GENERATE_CONTENT",
  support_chat: "GEMINI_MODEL_SUPPORT_CHAT",
  cover_prompt: "GEMINI_MODEL_COVER_PROMPT",
  video_prompt: "GEMINI_MODEL_VIDEO_PROMPT",
};

function readSecret(name: string): string {
  return (Deno.env.get(name) || "").trim();
}

export function resolveGeminiChatModel(): string {
  return readSecret("GEMINI_MODEL") || DEFAULT_GEMINI_CHAT_MODEL;
}

/** Chat / JSON model for a feature (uses GEMINI_MODEL_* then GEMINI_MODEL). */
export function resolveGeminiModelForSlot(slot: GeminiChatModelSlot): string {
  if (slot !== "default") {
    const specific = readSecret(SLOT_SECRET[slot]);
    if (specific) return specific;
  }
  return resolveGeminiChatModel();
}

/** Cover lab & artwork — Nano Banana family (`GEMINI_IMAGE_MODEL`). */
export function resolveGeminiImageModel(): string {
  return readSecret("GEMINI_IMAGE_MODEL") || DEFAULT_GEMINI_IMAGE_MODEL;
}

/** Aliases for Nano Banana model names in secrets (optional convenience). */
export function normalizeGeminiImageModelAlias(model: string): string {
  const m = model.trim().toLowerCase();
  if (m === "nano-banana" || m === "nano_banana" || m === "nanobanana") {
    return LEGACY_GEMINI_IMAGE_MODEL;
  }
  if (m === "nano-banana-2" || m === "nano_banana_2" || m === "nanobanana2") {
    return DEFAULT_GEMINI_IMAGE_MODEL;
  }
  if (m === "nano-banana-pro" || m === "nano_banana_pro") {
    return "gemini-3-pro-image";
  }
  if (m === "nano-banana-2-lite" || m === "nano_banana_2_lite") {
    return "gemini-3.1-flash-lite-image";
  }
  return model.trim();
}

export function resolveGeminiImageModelResolved(): string {
  return normalizeGeminiImageModelAlias(resolveGeminiImageModel());
}

/** Interactions API (Nano Banana 2+) vs legacy generateContent. */
export function geminiImageUsesInteractionsApi(model: string): boolean {
  const mode = readSecret("GEMINI_IMAGE_API").toLowerCase();
  if (mode === "generatecontent" || mode === "generate_content") return false;
  if (mode === "interactions") return true;
  const id = model.toLowerCase();
  if (id.includes("2.5") && id.includes("image")) return false;
  return /gemini-3(\.|$|-)/.test(id) && id.includes("image");
}

export function publicGeminiModelSecrets(): Record<string, string> {
  return {
    GEMINI_MODEL: "Default chat (fallback for all slots)",
    GEMINI_MODEL_ANALYZE_SONG: "Song analysis",
    GEMINI_MODEL_GENERATE_CAMPAIGN: "Campaign plan generation",
    GEMINI_MODEL_GENERATE_CONTENT: "Hooks, captions, hashtags, etc.",
    GEMINI_MODEL_SUPPORT_CHAT: "In-app support assistant",
    GEMINI_MODEL_COVER_PROMPT: "Cover art prompt polish (text only)",
    GEMINI_MODEL_VIDEO_PROMPT: "AI video motion prompt (text only)",
    GEMINI_IMAGE_MODEL: "Cover / artwork pixels (Nano Banana)",
    GEMINI_IMAGE_API: "Optional: interactions | generateContent",
  };
}
