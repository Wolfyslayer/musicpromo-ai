/**
 * Map provider USD estimates to in-app credits (usage-based billing).
 *
 * Env:
 * - CREDIT_USD_VALUE — USD value of 1 credit (default 0.01 → 100 credits ≈ $1)
 * - CREDIT_MARKUP — multiplier on provider cost (default 1.15)
 * - ATLAS_WAN_USD_PER_SEC — Wan 3.0 I2V list price (default 0.05)
 * - ATLAS_LLM_USD_PER_1M_INPUT / ATLAS_LLM_USD_PER_1M_OUTPUT — optional token rates
 */

export type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

function creditUsdValue(): number {
  const n = Number(Deno.env.get("CREDIT_USD_VALUE") || "0.01");
  return Number.isFinite(n) && n > 0 ? n : 0.01;
}

function creditMarkup(): number {
  const n = Number(Deno.env.get("CREDIT_MARKUP") || "1.15");
  return Number.isFinite(n) && n >= 1 ? n : 1.15;
}

export function usageBasedCreditsEnabled(): boolean {
  const v = (Deno.env.get("USAGE_BASED_CREDITS") || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Convert provider USD (before markup) to integer credits charged to the user. */
export function creditsFromProviderUsd(usd: number): number {
  const base = Math.max(0, Number(usd) || 0);
  if (base <= 0) return 0;
  const withMarkup = base * creditMarkup();
  return Math.max(1, Math.ceil(withMarkup / creditUsdValue()));
}

export function atlasWanUsdPerSecond(): number {
  const n = Number(Deno.env.get("ATLAS_WAN_USD_PER_SEC") || "0.05");
  return Number.isFinite(n) && n > 0 ? n : 0.05;
}

export function creditsForAtlasVideoSeconds(seconds: number, resolution: string): number {
  const sec = Math.min(30, Math.max(2, Math.floor(Number(seconds) || 5)));
  let usd = sec * atlasWanUsdPerSecond();
  const res = String(resolution || "720p").toLowerCase();
  if (res.includes("1080")) usd *= 1.25;
  if (res.includes("480")) usd *= 0.85;
  return creditsFromProviderUsd(usd);
}

export function atlasLlmTokenRates(): { inputPer1M: number; outputPer1M: number } {
  return {
    inputPer1M: Number(Deno.env.get("ATLAS_LLM_USD_PER_1M_INPUT") || "0.25") || 0.25,
    outputPer1M: Number(Deno.env.get("ATLAS_LLM_USD_PER_1M_OUTPUT") || "0.85") || 0.85,
  };
}

export function geminiLlmTokenRates(): { inputPer1M: number; outputPer1M: number } {
  return {
    inputPer1M: Number(Deno.env.get("GEMINI_LLM_USD_PER_1M_INPUT") || "0.10") || 0.10,
    outputPer1M: Number(Deno.env.get("GEMINI_LLM_USD_PER_1M_OUTPUT") || "0.40") || 0.40,
  };
}

export function llmTokenRatesForBilling(): { inputPer1M: number; outputPer1M: number } {
  const provider = (Deno.env.get("AI_PROVIDER") || "gemini").trim().toLowerCase();
  if (provider === "atlas" || provider === "atlascloud") return atlasLlmTokenRates();
  if (provider === "openai") {
    return {
      inputPer1M: Number(Deno.env.get("OPENAI_LLM_USD_PER_1M_INPUT") || "0.15") || 0.15,
      outputPer1M: Number(Deno.env.get("OPENAI_LLM_USD_PER_1M_OUTPUT") || "0.60") || 0.60,
    };
  }
  return geminiLlmTokenRates();
}

export function creditsFromTokenUsage(usage: TokenUsage | undefined | null): number {
  if (!usage) return 0;
  const { inputPer1M, outputPer1M } = llmTokenRatesForBilling();
  const prompt = Number(usage.prompt_tokens) || 0;
  const completion = Number(usage.completion_tokens) || 0;
  const usd = (prompt / 1_000_000) * inputPer1M + (completion / 1_000_000) * outputPer1M;
  return creditsFromProviderUsd(usd);
}

/** Conservative pre-auth hold before an LLM call (refund overage after). */
export function estimateLlmCreditHold(promptChars: number, maxOutputTokens = 4096): number {
  const { inputPer1M, outputPer1M } = llmTokenRatesForBilling();
  const promptTokens = Math.ceil(Math.max(0, promptChars) / 4);
  const usd =
    (promptTokens / 1_000_000) * inputPer1M + (Math.max(512, maxOutputTokens) / 1_000_000) * outputPer1M;
  return creditsFromProviderUsd(usd * 1.2);
}

/** Credits to charge after an LLM call when usage-based billing is on. */
export function resolveMeteredLlmCredits(result: Record<string, unknown>, promptChars: number): number {
  const explicit = Number(result._usageCredits);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  const usage = result._tokenUsage as TokenUsage | undefined;
  const fromTokens = creditsFromTokenUsage(usage);
  if (fromTokens > 0) return fromTokens;
  return estimateLlmCreditHold(promptChars, 2048);
}

export function stripMeteredResponseFields<T extends Record<string, unknown>>(obj: T) {
  const { _usageCredits, _tokenUsage, ...rest } = obj;
  return rest;
}

export function creditsForCloudVideoClip(provider: "atlas" | "fal" | "replicate", durationSec: number, resolution: string): number {
  if (provider === "atlas") return creditsForAtlasVideoSeconds(durationSec, resolution);
  if (provider === "fal") return creditsFromProviderUsd(Number(Deno.env.get("FAL_CLIP_USD_ESTIMATE") || "0.20") || 0.2);
  const sec = Math.min(30, Math.max(2, Math.floor(Number(durationSec) || 5)));
  const perSec = Number(Deno.env.get("REPLICATE_WAN_USD_PER_SEC") || "0.09") || 0.09;
  return creditsFromProviderUsd(sec * perSec);
}
