import {
  buildGeminiInlineParts,
  buildMultimodalPromptPrefix,
  planMediaAttachments,
} from "./aiMediaContext.ts";
import { invokeGeminiJson, resolveAnalyzeSongModel, resolveGenerateCampaignModel } from "./geminiMultimodalLlm.ts";
import { invokeLlm } from "./invokeLlm.ts";

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
  const model =
    args.modelKind === "analyze_song" ? resolveAnalyzeSongModel() : resolveGenerateCampaignModel();

  const attachMeta = loaded.length
    ? {
        mediaContext: {
          artwork: loaded.some((i) => i.kind === "image"),
          audioTracks: loaded.filter((i) => i.kind === "audio").map((i) => i.label),
        },
      }
    : {};

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

  const textResult = await invokeLlm({
    prompt: fullPrompt,
    response_json_schema: args.schema,
  });
  if (typeof textResult === "object" && textResult) {
    return { ...textResult, ...attachMeta };
  }
  return { result: textResult, ...attachMeta };
}
