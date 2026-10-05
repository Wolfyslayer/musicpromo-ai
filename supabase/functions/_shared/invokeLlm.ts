/**
 * OpenAI-compatible chat completion used by migrated Base44 InvokeLLM call sites.
 *
 * Defaults to Google Gemini (free tier) via OpenAI-compatible endpoint.
 *
 * Supabase secrets (Gemini — recommended):
 * - GEMINI_API_KEY — from https://aistudio.google.com/apikey
 * - GEMINI_MODEL — optional, default gemini-3.8-flash
 * - AI_PROVIDER=gemini (default) | openai
 *
 * Legacy OpenAI / Groq:
 * - OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
 */

import {
  type AiProviderMode,
  geminiLlmSetupHint,
  hasLlmConfigured,
  llmSetupHint,
  resolveAiProvider,
  resolveLlmRuntime,
} from "./aiProvider.ts";

type InvokeLlmArgs = {
  prompt?: string;
  response_json_schema?: Record<string, unknown>;
  add_context_from_internet?: boolean;
  file_urls?: string[];
  /** When set, bypasses AI_PROVIDER (e.g. song analysis always uses Gemini). */
  provider?: AiProviderMode;
};

function extractJson(text: string): unknown {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("Model returned an empty response.");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Model response was not valid JSON.");
  }
}

export async function invokeLlm(args: InvokeLlmArgs): Promise<string | Record<string, unknown>> {
  const runtime = resolveLlmRuntime(args.provider);
  if (!runtime.apiKey) {
    throw new Error(args.provider === "gemini" ? geminiLlmSetupHint() : llmSetupHint());
  }

  const prompt = String(args.prompt || "").trim();
  if (!prompt) throw new Error("prompt is required.");

  if (args.add_context_from_internet) {
    console.warn("[invokeLlm] add_context_from_internet is not supported on Supabase; continuing without web search.");
  }
  if (args.file_urls?.length) {
    console.warn("[invokeLlm] file_urls are not supported on Supabase; ignoring attachments.");
  }

  const schema = args.response_json_schema;
  const baseBody: Record<string, unknown> = {
    model: runtime.model,
    messages: [{ role: "user", content: prompt }],
  };

  async function requestWithBody(body: Record<string, unknown>): Promise<Response> {
    return fetch(`${runtime.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtime.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  let body = { ...baseBody };
  if (schema && typeof schema === "object") {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "response",
        strict: false,
        schema,
      },
    };
  }

  let res = await requestWithBody(body);
  let raw = await res.text();

  // Gemini / Groq / some tiers reject json_schema — retry with json_object + prompt JSON hint.
  if (!res.ok && schema && (res.status === 400 || res.status === 422)) {
    console.warn("[invokeLlm] json_schema rejected; retrying with json_object");
    body = {
      ...baseBody,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nRespond with a single valid JSON object only, no markdown.`,
        },
      ],
    };
    res = await requestWithBody(body);
    raw = await res.text();
  }

  if (!res.ok) {
    if (res.status === 429 && /insufficient_quota|credit_balance|rate_limit|RESOURCE_EXHAUSTED/i.test(raw)) {
      throw new Error(
        runtime.provider === "gemini"
          ? "Gemini quota exceeded. Wait for the free-tier reset or enable billing in Google AI Studio — see docs/FREE_AI.md."
          : "AI quota exceeded. See docs/FREE_AI.md for Gemini (free) or Groq setup."
      );
    }
    if (res.status === 401 && /invalid_api_key|Invalid API Key|API key not valid/i.test(raw)) {
      throw new Error(
        runtime.provider === "gemini"
          ? "AI API key rejected (401). Set GEMINI_API_KEY (AIza…) in Supabase Edge Function secrets. Delete or replace any old OPENAI_API_KEY (sk-…) and unset OPENAI_BASE_URL unless you use Groq with AI_PROVIDER=openai. See docs/FREE_AI.md."
          : "AI API key rejected (401). Check OPENAI_API_KEY and OPENAI_BASE_URL in Supabase Edge Function secrets. See docs/FREE_AI.md."
      );
    }
    if (res.status === 404 && /no longer available|NOT_FOUND|models\//i.test(raw)) {
      throw new Error(
        "Gemini model not available (404). Set Supabase secret GEMINI_MODEL=gemini-3.8-flash (or redeploy latest edge functions). See docs/FREE_AI.md."
      );
    }
    throw new Error(`AI request failed (${res.status}): ${raw.slice(0, 400)}`);
  }

  let parsed: { choices?: { message?: { content?: string } }[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI provider returned non-JSON.");
  }

  const content = parsed.choices?.[0]?.message?.content;
  if (content == null) throw new Error("AI provider returned no message content.");

  if (schema) {
    return extractJson(content) as Record<string, unknown>;
  }
  return content;
}

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export async function invokeLlmChat(args: {
  messages: ChatMessage[];
  response_json_schema?: Record<string, unknown>;
}): Promise<string | Record<string, unknown>> {
  const apiKey = resolveLlmApiKey();
  if (!apiKey) {
    throw new Error(llmSetupHint());
  }

  const messages = (args.messages || [])
    .filter((m) => m?.content && String(m.content).trim())
    .map((m) => ({
      role: m.role === "assistant" || m.role === "system" ? m.role : "user",
      content: String(m.content).trim().slice(0, 8000),
    }));
  if (!messages.length) throw new Error("messages are required.");

  const schema = args.response_json_schema;
  const baseBody: Record<string, unknown> = {
    model: resolveLlmModel(),
    messages,
  };

  async function requestWithBody(body: Record<string, unknown>): Promise<Response> {
    return fetch(`${resolveLlmBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  let body = { ...baseBody };
  if (schema && typeof schema === "object") {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: "response", strict: false, schema },
    };
  }

  let res = await requestWithBody(body);
  let raw = await res.text();

  if (!res.ok && schema && (res.status === 400 || res.status === 422)) {
    body = {
      ...baseBody,
      response_format: { type: "json_object" },
      messages: [
        ...messages.slice(0, -1),
        {
          role: "user",
          content: `${messages[messages.length - 1]?.content}\n\nRespond with a single valid JSON object only.`,
        },
      ],
    };
    res = await requestWithBody(body);
    raw = await res.text();
  }

  if (!res.ok) {
    if (res.status === 401 && /invalid_api_key|Invalid API Key|API key not valid/i.test(raw)) {
      throw new Error(
        resolveAiProvider() === "gemini"
          ? "AI API key rejected (401). In Supabase → Edge Functions → Secrets, set a valid GEMINI_API_KEY from Google AI Studio (https://aistudio.google.com/apikey). See docs/FREE_AI.md."
          : "AI API key rejected (401). Check OPENAI_API_KEY and OPENAI_BASE_URL in Supabase Edge Function secrets. See docs/FREE_AI.md."
      );
    }
    if (res.status === 404 && /no longer available|NOT_FOUND|models\//i.test(raw)) {
      throw new Error(
        "Gemini model not available (404). Set Supabase secret GEMINI_MODEL=gemini-3.8-flash (or redeploy latest edge functions). See docs/FREE_AI.md."
      );
    }
    throw new Error(`AI request failed (${res.status}): ${raw.slice(0, 400)}`);
  }

  const parsed = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
  const content = parsed.choices?.[0]?.message?.content;
  if (content == null) throw new Error("AI provider returned no message content.");

  if (schema) return extractJson(content) as Record<string, unknown>;
  return content;
}

export { hasLlmConfigured };
