/**
 * Default AI stack: Google Gemini (free tier via AI Studio API key).
 * Override with AI_PROVIDER=openai and OpenAI secrets when needed.
 */

import {
  type GeminiChatModelSlot,
  resolveGeminiChatModel,
  resolveGeminiModelForSlot,
} from "./geminiModels.ts";
import { atlasChatCompletionsUrl, hasAtlasConfigured, resolveAtlasChatModel } from "./atlasCloud.ts";

export type AiProviderMode = "gemini" | "openai" | "atlas";

export { resolveGeminiChatModel } from "./geminiModels.ts";

const GEMINI_OPENAI_COMPAT_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const OPENAI_DEFAULT_BASE = "https://api.openai.com/v1";
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
  if (mode === "atlas" || mode === "atlascloud") return "atlas";
  if (mode === "openai") return "openai";
  return "gemini";
}

/** Chat / JSON LLM key (Gemini AI Studio key by default). */
export function resolveLlmApiKey(): string {
  const atlas = normalizeSecret(Deno.env.get("ATLASCLOUD_API_KEY") || Deno.env.get("ATLAS_CLOUD_API_KEY") || "");
  if (resolveAiProvider() === "atlas") return atlas;
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
  if (resolveAiProvider() === "atlas") return hasAtlasConfigured();
  return Boolean(resolveLlmApiKey());
}

export function resolveLlmBaseUrl(): string {
  if (resolveAiProvider() === "atlas") return atlasChatCompletionsUrl().replace(/\/chat\/completions$/, "");
  const custom = normalizeSecret(Deno.env.get("OPENAI_BASE_URL") || "");
  // Groq/OpenAI base URL applies only in openai mode — otherwise Gemini requests hit the wrong host.
  if (custom && resolveAiProvider() === "openai") return custom.replace(/\/+$/, "");
  return resolveAiProvider() === "gemini" ? GEMINI_OPENAI_COMPAT_BASE : OPENAI_DEFAULT_BASE;
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
  if (provider === "atlas") {
    return resolveAtlasChatModel();
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

export type LlmRuntimeOptions = {
  provider?: AiProviderMode;
  /** When provider is gemini, pick GEMINI_MODEL_* for this feature. */
  modelSlot?: GeminiChatModelSlot;
  model?: string;
};

/** Resolved API key, host, and model for one chat completion request. */
export function resolveLlmRuntime(options?: AiProviderMode | LlmRuntimeOptions): LlmRuntimeConfig {
  const opts: LlmRuntimeOptions =
    options === "gemini" || options === "openai" ? { provider: options } : options ?? {};
  const provider = opts.provider ?? resolveAiProvider();
  if (provider === "atlas") {
    return {
      provider,
      apiKey: resolveLlmApiKey(),
      baseUrl: atlasChatCompletionsUrl().replace(/\/chat\/completions$/, ""),
      model: opts.model?.trim() || resolveAtlasChatModel(),
    };
  }
  if (provider === "gemini") {
    const model =
      opts.model?.trim() ||
      (opts.modelSlot ? resolveGeminiModelForSlot(opts.modelSlot) : resolveGeminiChatModel());
    return {
      provider,
      apiKey: resolveGeminiLlmApiKey(),
      baseUrl: GEMINI_OPENAI_COMPAT_BASE,
      model,
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
  if (resolveAiProvider() === "atlas") {
    return "Set AI_PROVIDER=atlas and ATLASCLOUD_API_KEY (https://www.atlascloud.ai/console/api-keys) in Supabase Edge Function secrets.";
  }
  if (resolveAiProvider() === "gemini") {
    return "Set GEMINI_API_KEY from Google AI Studio (https://aistudio.google.com/apikey) in Supabase Edge Function secrets. Remove stale OPENAI_API_KEY (sk-…) and OPENAI_BASE_URL unless AI_PROVIDER=openai.";
  }
  return "Set AI_PROVIDER=openai, OPENAI_API_KEY, and OPENAI_BASE_URL (e.g. Groq) in Supabase Edge Function secrets.";
}
