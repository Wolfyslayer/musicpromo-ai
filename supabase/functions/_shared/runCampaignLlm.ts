import {
  buildGeminiInlineParts,
  buildMultimodalPromptPrefix,
  planMediaAttachments,
} from "./aiMediaContext.ts";
import { invokeGeminiJson, resolveModelForCampaignKind } from "./geminiMultimodalLlm.ts";
import type { GeminiChatModelSlot } from "./geminiModels.ts";
import { invokeLlm, invokeLlmWithUsage } from "./invokeLlm.ts";
import { resolveAiProvider } from "./aiProvider.ts";
import { creditsFromTokenUsage, usageBasedCreditsEnabled } from "./usageCredits.ts";

/** Gemini JSON call with optional artwork + audio; falls back to text-only OpenAI-compat LLM. */
export async function runGeminiCampaignLlm(args: {
  body: Record<string, unknown>;
  prompt: string;
  schema: Record<string, unknown>;
  modelKind: "analyze_song" | "generate_campaign";
}) {
  const { items, hints } = planMediaAttachments(args.body);
  const { parts, loaded } = await buildGeminiInlineParts(items);
  const fullPrompt = buildMultimodalPromptPrefix(hints) + args.prompt;
  const modelSlot: GeminiChatModelSlot =
    args.modelKind === "analyze_song" ? "analyze_song" : "generate_campaign";
  const model = resolveModelForCampaignKind(args.modelKind);

  const attachMeta = loaded.length
    ? {
        mediaContext: {
          artwork: loaded.some((i) => i.kind === "image"),
          audioTracks: loaded.filter((i) => i.kind === "audio").map((i) => i.label),
        },
      }
    : {};

  if (resolveAiProvider() === "atlas") {
    const { content, usage } = await invokeLlmWithUsage({
      prompt: fullPrompt,
      response_json_schema: args.schema,
      provider: "atlas",
      modelSlot,
    });
    const creditCost = creditsFromTokenUsage(usage);
    const payload =
      typeof content === "object" && content
        ? { ...content, _usageCredits: creditCost, _tokenUsage: usage }
        : { result: content, _usageCredits: creditCost, _tokenUsage: usage };
    return { ...payload, ...attachMeta };
  }

  try {
    if (parts.length) {
      const result = await invokeGeminiJson({
        prompt: fullPrompt,
        schema: args.schema,
        inlineParts: parts,
        model,
      });
      return { ...result, ...attachMeta };
    }
  } catch (err) {
    console.warn("[runCampaignLlm] multimodal failed, retrying text-only:", (err as Error).message);
  }

  const { content: textResult, usage } = await invokeLlmWithUsage({
    prompt: fullPrompt,
    response_json_schema: args.schema,
    provider: "gemini",
    modelSlot,
  });
  const creditCost = creditsFromTokenUsage(usage);
  const usageMeta = usageBasedCreditsEnabled()
    ? { _usageCredits: creditCost, _tokenUsage: usage }
    : {};
  if (typeof textResult === "object" && textResult) {
    return { ...textResult, ...attachMeta, ...usageMeta };
  }
  return { result: textResult, ...attachMeta, ...usageMeta };
}
