/**
 * Default AI stack: Google Gemini (free tier via AI Studio API key).
 * Override with AI_PROVIDER=openai and OpenAI secrets when needed.
 */

export type AiProviderMode = "gemini" | "openai";

const GEMINI_OPENAI_COMPAT_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const OPENAI_DEFAULT_BASE = "https://api.openai.com/v1";
const DEFAULT_GEMINI_CHAT_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENAI_CHAT_MODEL = "gpt-4o-mini";

function normalizeSecret(value: string): string {
  return String(value || "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "");
}

export function resolveAiProvider(): AiProviderMode {
  const mode = normalizeSecret(Deno.env.get("AI_PROVIDER") || "gemini").toLowerCase();
  if (mode === "openai") return "openai";
  return "gemini";
}

/** Chat / JSON LLM key (Gemini AI Studio key by default). */
export function resolveLlmApiKey(): string {
  const gemini = normalizeSecret(Deno.env.get("GEMINI_API_KEY") || "");
  const legacy = normalizeSecret(
    Deno.env.get("OPENAI_API_KEY") || Deno.env.get("AI_API_KEY") || ""
  );
  if (resolveAiProvider() === "gemini") {
    return gemini || legacy;
  }
  return legacy || gemini;
}

/** Native Gemini REST (images) — same key as chat unless GEMINI_API_KEY is set alone. */
export function resolveGeminiApiKey(): string {
  return normalizeSecret(
    Deno.env.get("GEMINI_API_KEY") || Deno.env.get("OPENAI_API_KEY") || Deno.env.get("AI_API_KEY") || ""
  );
}

export function hasLlmConfigured(): boolean {
  return Boolean(resolveLlmApiKey());
}

export function resolveLlmBaseUrl(): string {
  const custom = (Deno.env.get("OPENAI_BASE_URL") || "").trim();
  if (custom) return custom.replace(/\/+$/, "");
  return resolveAiProvider() === "gemini" ? GEMINI_OPENAI_COMPAT_BASE : OPENAI_DEFAULT_BASE;
}

export function resolveLlmModel(): string {
  const custom = (Deno.env.get("OPENAI_MODEL") || Deno.env.get("AI_MODEL") || "").trim();
  if (custom) return custom;
  const geminiModel = (Deno.env.get("GEMINI_MODEL") || "").trim();
  if (resolveAiProvider() === "gemini") {
    return geminiModel || DEFAULT_GEMINI_CHAT_MODEL;
  }
  return DEFAULT_OPENAI_CHAT_MODEL;
}

export function llmSetupHint(): string {
  if (resolveAiProvider() === "gemini") {
    return "Set GEMINI_API_KEY from Google AI Studio (https://aistudio.google.com/apikey) in Supabase Edge Function secrets.";
  }
  return "Set OPENAI_API_KEY in Supabase Edge Function secrets.";
}
