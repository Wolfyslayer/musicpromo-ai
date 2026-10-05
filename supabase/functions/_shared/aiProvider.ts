/**
 * Default AI stack: Google Gemini (free tier via AI Studio API key).
 * Override with AI_PROVIDER=openai and OpenAI secrets when needed.
 */

export type AiProviderMode = "gemini" | "openai";

const GEMINI_OPENAI_COMPAT_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const OPENAI_DEFAULT_BASE = "https://api.openai.com/v1";
const DEFAULT_GEMINI_CHAT_MODEL = "gemini-3.8-flash";
const DEFAULT_OPENAI_CHAT_MODEL = "gpt-4o-mini";

/** Gemini AI Studio / Google API keys — not OpenAI `sk-` keys. */
function looksLikeGeminiApiKey(key: string): boolean {
  return /^(AIza|AQ\.)/.test(key);
}

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
    if (gemini) return gemini;
    // Legacy: some projects stored the Gemini key in OPENAI_API_KEY — do not send sk- keys to Gemini.
    if (legacy && looksLikeGeminiApiKey(legacy)) return legacy;
    return "";
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
  const custom = normalizeSecret(Deno.env.get("OPENAI_BASE_URL") || "");
  // Groq/OpenAI base URL applies only in openai mode — otherwise Gemini requests hit the wrong host.
  if (custom && resolveAiProvider() === "openai") return custom.replace(/\/+$/, "");
  return resolveAiProvider() === "gemini" ? GEMINI_OPENAI_COMPAT_BASE : OPENAI_DEFAULT_BASE;
}

export function resolveGeminiChatModel(): string {
  const geminiModel = (Deno.env.get("GEMINI_MODEL") || "").trim();
  return geminiModel || DEFAULT_GEMINI_CHAT_MODEL;
}

/** Gemini chat key only (never Groq/OpenAI sk- keys). */
export function resolveGeminiLlmApiKey(): string {
  const gemini = normalizeSecret(Deno.env.get("GEMINI_API_KEY") || "");
  if (gemini) return gemini;
  const legacy = normalizeSecret(
    Deno.env.get("OPENAI_API_KEY") || Deno.env.get("AI_API_KEY") || ""
  );
  if (legacy && looksLikeGeminiApiKey(legacy)) return legacy;
  return "";
}

export function resolveLlmModelForProvider(provider: AiProviderMode): string {
  if (provider === "gemini") {
    return resolveGeminiChatModel();
  }
  const custom = (Deno.env.get("OPENAI_MODEL") || Deno.env.get("AI_MODEL") || "").trim();
  return custom || DEFAULT_OPENAI_CHAT_MODEL;
}

export function resolveLlmModel(): string {
  return resolveLlmModelForProvider(resolveAiProvider());
}

export type LlmRuntimeConfig = {
  provider: AiProviderMode;
  apiKey: string;
  baseUrl: string;
  model: string;
};

/** Resolved API key, host, and model for one chat completion request. */
export function resolveLlmRuntime(providerOverride?: AiProviderMode): LlmRuntimeConfig {
  const provider = providerOverride ?? resolveAiProvider();
  if (provider === "gemini") {
    return {
      provider,
      apiKey: resolveGeminiLlmApiKey(),
      baseUrl: GEMINI_OPENAI_COMPAT_BASE,
      model: resolveGeminiChatModel(),
    };
  }
  const custom = normalizeSecret(Deno.env.get("OPENAI_BASE_URL") || "");
  return {
    provider,
    apiKey: resolveLlmApiKey(),
    baseUrl: custom ? custom.replace(/\/+$/, "") : OPENAI_DEFAULT_BASE,
    model: resolveLlmModelForProvider("openai"),
  };
}

export function geminiLlmSetupHint(): string {
  return "Song analysis uses Google Gemini. Set GEMINI_API_KEY from Google AI Studio (https://aistudio.google.com/apikey) in Supabase Edge Function secrets (even when AI_PROVIDER=openai for other features).";
}

export function llmSetupHint(): string {
  if (resolveAiProvider() === "gemini") {
    return "Set GEMINI_API_KEY from Google AI Studio (https://aistudio.google.com/apikey) in Supabase Edge Function secrets. Remove stale OPENAI_API_KEY (sk-…) and OPENAI_BASE_URL unless AI_PROVIDER=openai.";
  }
  return "Set AI_PROVIDER=openai, OPENAI_API_KEY, and OPENAI_BASE_URL (e.g. Groq) in Supabase Edge Function secrets.";
}
