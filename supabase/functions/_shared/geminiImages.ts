import { resolveGeminiApiKey } from "./aiProvider.ts";
import {
  geminiImageUsesInteractionsApi,
  resolveGeminiImageModelResolved,
} from "./geminiModels.ts";

export { resolveGeminiImageModel, resolveGeminiImageModelResolved } from "./geminiModels.ts";

function geminiApiVersion(): string {
  return (Deno.env.get("GEMINI_API_VERSION") || "v1beta").replace(/^\//, "").trim();
}

function geminiApiRevision(): string | null {
  const rev = (Deno.env.get("GEMINI_API_REVISION") || "2026-05-20").trim();
  return rev || null;
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

function extractImageFromInteractionBody(data: Record<string, unknown>): { imageBytes: Uint8Array; mimeType: string } | null {
  const outputImage = data.output_image as { data?: string; mime_type?: string; mimeType?: string } | undefined;
  if (outputImage?.data) {
    return {
      imageBytes: decodeBase64Image(String(outputImage.data)),
      mimeType: String(outputImage.mime_type || outputImage.mimeType || "image/png").split(";")[0],
    };
  }

  const walk = (node: unknown): { imageBytes: Uint8Array; mimeType: string } | null => {
    if (!node || typeof node !== "object") return null;
    const obj = node as Record<string, unknown>;
    if (obj.type === "image" && obj.data) {
      return {
        imageBytes: decodeBase64Image(String(obj.data)),
        mimeType: String(obj.mime_type || obj.mimeType || "image/png").split(";")[0],
      };
    }
    for (const key of ["outputs", "steps", "content"]) {
      const child = obj[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          const found = walk(item);
          if (found) return found;
        }
      }
    }
    return null;
  };

  return walk(data);
}

async function geminiInteractionsGenerateImage(args: {
  apiKey: string;
  model: string;
  prompt: string;
  referenceImageBytes?: Uint8Array;
  referenceMimeType?: string;
}): Promise<{ imageBytes: Uint8Array; mimeType: string }> {
  const input: Record<string, unknown>[] = [{ type: "text", text: args.prompt.slice(0, 8000) }];
  if (args.referenceImageBytes?.byteLength) {
    input.push({
      type: "image",
      mime_type: args.referenceMimeType || "image/png",
      data: bytesToBase64(args.referenceImageBytes),
    });
  }

  const version = geminiApiVersion();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-goog-api-key": args.apiKey,
  };
  const revision = geminiApiRevision();
  if (revision) headers["Api-Revision"] = revision;

  const res = await fetch(`https://generativelanguage.googleapis.com/${version}/interactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: args.model,
      input,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = data?.error as { message?: string } | undefined;
    throw new Error(`Gemini image interactions error (${res.status}): ${err?.message || JSON.stringify(data)}`);
  }

  const image = extractImageFromInteractionBody(data);
  if (!image) {
    throw new Error("Gemini interactions returned no image bytes.");
  }
  return image;
}

async function geminiGenerateContentImage(args: {
  apiKey: string;
  model: string;
  prompt: string;
  referenceImageBytes?: Uint8Array;
  referenceMimeType?: string;
}): Promise<{ imageBytes: Uint8Array; mimeType: string }> {
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
  const res = await fetch(
    `https://generativelanguage.googleapis.com/${version}/models/${args.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": args.apiKey,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data);
    throw new Error(`Gemini image generateContent error (${res.status}): ${msg}`);
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
  return image;
}

/**
 * Gemini Nano Banana image generate / edit (Interactions API for 3.x, generateContent for 2.5).
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

  const model = resolveGeminiImageModelResolved();
  const useInteractions = geminiImageUsesInteractionsApi(model);

  let image: { imageBytes: Uint8Array; mimeType: string };
  if (useInteractions) {
    try {
      image = await geminiInteractionsGenerateImage({
        apiKey,
        model,
        prompt: args.prompt,
        referenceImageBytes: args.referenceImageBytes,
        referenceMimeType: args.referenceMimeType,
      });
    } catch (interactionsErr) {
      console.warn(
        "[geminiImages] interactions failed, retrying generateContent:",
        (interactionsErr as Error).message
      );
      image = await geminiGenerateContentImage({
        apiKey,
        model,
        prompt: args.prompt,
        referenceImageBytes: args.referenceImageBytes,
        referenceMimeType: args.referenceMimeType,
      });
    }
  } else {
    image = await geminiGenerateContentImage({
      apiKey,
      model,
      prompt: args.prompt,
      referenceImageBytes: args.referenceImageBytes,
      referenceMimeType: args.referenceMimeType,
    });
  }

  return { ...image, model };
}
