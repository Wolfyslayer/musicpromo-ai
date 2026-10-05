import { resolveGeminiApiKey } from "./aiProvider.ts";

const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

export function resolveGeminiImageModel(): string {
  return (Deno.env.get("GEMINI_IMAGE_MODEL") || DEFAULT_GEMINI_IMAGE_MODEL).trim();
}

function geminiApiVersion(): string {
  return (Deno.env.get("GEMINI_API_VERSION") || "v1beta").replace(/^\//, "").trim();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function decodeBase64Image(b64: string): Uint8Array {
  const binary = atob(b64.replace(/\s/g, ""));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

type GeminiPart = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
};

function extractImageFromParts(parts: GeminiPart[]): { imageBytes: Uint8Array; mimeType: string } | null {
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    const data = inline?.data;
    if (!data) continue;
    const mimeType =
      (part.inlineData?.mimeType || part.inline_data?.mime_type || "image/png").split(";")[0];
    return { imageBytes: decodeBase64Image(String(data)), mimeType };
  }
  return null;
}

/**
 * Gemini Nano Banana image generate / edit (text prompt, optional reference image).
 */
export async function geminiGenerateImage(args: {
  prompt: string;
  referenceImageBytes?: Uint8Array;
  referenceMimeType?: string;
}): Promise<{ imageBytes: Uint8Array; mimeType: string; model: string }> {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error("Set GEMINI_API_KEY (Google AI Studio) in Supabase Edge Function secrets.");
  }

  const model = resolveGeminiImageModel();
  const parts: Record<string, unknown>[] = [];

  if (args.referenceImageBytes?.byteLength) {
    parts.push({
      inline_data: {
        mime_type: args.referenceMimeType || "image/png",
        data: bytesToBase64(args.referenceImageBytes),
      },
    });
  }
  parts.push({ text: args.prompt.slice(0, 8000) });

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  const version = geminiApiVersion();
  const res = await fetch(`https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data);
    throw new Error(`Gemini image error (${res.status}): ${msg}`);
  }

  const partsOut: GeminiPart[] = data?.candidates?.[0]?.content?.parts || [];
  const image = extractImageFromParts(partsOut);
  if (!image) {
    const block = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
    throw new Error(
      block
        ? `Gemini did not return an image (${block}). Try a different prompt or GEMINI_IMAGE_MODEL.`
        : "Gemini returned no image bytes."
    );
  }

  return { ...image, model };
}
