/**
 * OpenAI-compatible chat completion used by migrated Base44 InvokeLLM call sites.
 *
 * Supabase secrets:
 * - OPENAI_API_KEY (required)
 * - OPENAI_MODEL (optional, default gpt-4o-mini)
 * - OPENAI_BASE_URL (optional, default https://api.openai.com/v1)
 */

type InvokeLlmArgs = {
  prompt?: string;
  response_json_schema?: Record<string, unknown>;
  add_context_from_internet?: boolean;
  file_urls?: string[];
};

function modelName(): string {
  return Deno.env.get("OPENAI_MODEL") || Deno.env.get("AI_MODEL") || "gpt-4o-mini";
}

function apiBase(): string {
  const base = Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1";
  return base.replace(/\/+$/, "");
}

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
  const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("AI_API_KEY") || "";
  if (!apiKey) {
    throw new Error(
      "Set OPENAI_API_KEY in Supabase Edge Function secrets (Project Settings → Edge Functions)."
    );
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
    model: modelName(),
    messages: [{ role: "user", content: prompt }],
  };

  async function requestWithBody(body: Record<string, unknown>): Promise<Response> {
    return fetch(`${apiBase()}/chat/completions`, {
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
      json_schema: {
        name: "response",
        strict: false,
        schema,
      },
    };
  }

  let res = await requestWithBody(body);
  let raw = await res.text();

  // Groq / some free tiers reject json_schema — retry with json_object + prompt JSON hint.
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
    if (res.status === 429 && /insufficient_quota|credit_balance|rate_limit/i.test(raw)) {
      throw new Error(
        "AI quota exceeded. Add OpenAI credits or switch to a free provider (Groq): set OPENAI_BASE_URL=https://api.groq.com/openai/v1 and a Groq API key — see docs/FREE_AI.md."
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
  const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("AI_API_KEY") || "";
  if (!apiKey) {
    throw new Error(
      "Set OPENAI_API_KEY in Supabase Edge Function secrets (Project Settings → Edge Functions)."
    );
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
    model: modelName(),
    messages,
  };

  async function requestWithBody(body: Record<string, unknown>): Promise<Response> {
    return fetch(`${apiBase()}/chat/completions`, {
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
    throw new Error(`AI request failed (${res.status}): ${raw.slice(0, 400)}`);
  }

  const parsed = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
  const content = parsed.choices?.[0]?.message?.content;
  if (content == null) throw new Error("AI provider returned no message content.");

  if (schema) return extractJson(content) as Record<string, unknown>;
  return content;
}
