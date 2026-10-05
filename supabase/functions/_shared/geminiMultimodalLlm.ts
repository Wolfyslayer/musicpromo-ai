import { resolveGeminiApiKey } from "./aiProvider.ts";
import type { GeminiInlinePart } from "./aiMediaContext.ts";

function geminiApiVersion(): string {
  return (Deno.env.get("GEMINI_API_VERSION") || "v1beta").replace(/^\//, "").trim();
}

function resolveModel(envKeys: string[], fallback: string): string {
  for (const key of envKeys) {
    const v = (Deno.env.get(key) || "").trim();
    if (v) return v;
  }
  return (Deno.env.get("GEMINI_MODEL") || "").trim() || fallback;
}

export function resolveAnalyzeSongModel(): string {
  return resolveModel(["GEMINI_MODEL_ANALYZE_SONG"], "gemini-3.8-flash");
}

export function resolveGenerateCampaignModel(): string {
  return resolveModel(["GEMINI_MODEL_GENERATE_CAMPAIGN"], "gemini-3.8-flash");
}

function extractJson(text: string): Record<string, unknown> {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("Model returned an empty response.");
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error("Model response was not valid JSON.");
  }
}

/**
 * Gemini native generateContent with optional image/audio parts + JSON schema output.
 */
export async function invokeGeminiJson(args: {
  prompt: string;
  schema: Record<string, unknown>;
  inlineParts?: GeminiInlinePart[];
  model: string;
}): Promise<Record<string, unknown>> {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error("Set GEMINI_API_KEY (Google AI Studio) in Supabase Edge Function secrets.");
  }

  const parts: GeminiInlinePart[] = [...(args.inlineParts || []), { text: args.prompt }];
  const version = geminiApiVersion();
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: args.schema,
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/${version}/models/${args.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message || JSON.stringify(data);
    throw new Error(`Gemini multimodal error (${res.status}): ${msg.slice(0, 500)}`);
  }

  const text =
    (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content
      ?.parts?.[0]?.text || "";
  return extractJson(text);
}
