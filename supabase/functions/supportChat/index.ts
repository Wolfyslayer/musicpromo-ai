import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { invokeLlmChat } from "../_shared/invokeLlm.ts";
import { buildSupportSystemPrompt } from "../_shared/supportChatPrompt.ts";

const MAX_MESSAGES = 24;
const MAX_TURNS_PER_HOUR = 40;
const HOUR_MS = 60 * 60 * 1000;

type ClientMessage = { role?: string; content?: string };

async function bumpRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const admin = serviceClient();
  const now = Date.now();
  const { data: row } = await admin
    .from("support_chat_usage")
    .select("message_count, window_start")
    .eq("user_id", userId)
    .maybeSingle();

  let count = Number(row?.message_count || 0);
  let windowStart = row?.window_start ? Date.parse(String(row.window_start)) : now;

  if (!row || now - windowStart >= HOUR_MS) {
    count = 0;
    windowStart = now;
  }

  if (count >= MAX_TURNS_PER_HOUR) {
    return { allowed: false, remaining: 0 };
  }

  count += 1;
  await admin.from("support_chat_usage").upsert({
    user_id: userId,
    message_count: count,
    window_start: new Date(windowStart).toISOString(),
  });

  return { allowed: true, remaining: MAX_TURNS_PER_HOUR - count };
}

async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Sign in to use the support assistant." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawMessages = Array.isArray(body?.messages) ? (body.messages as ClientMessage[]) : [];
    const pagePath = String(body?.pagePath || "").slice(0, 500);

    const messages = rawMessages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
      .slice(-MAX_MESSAGES)
      .map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: String(m.content).trim().slice(0, 4000),
      }));

    if (!messages.length || messages[messages.length - 1]?.role !== "user") {
      return Response.json({ error: "Send a user message to get a reply.", code: "VALIDATION" }, { status: 400 });
    }

    const uid = String(user.id);
    const rate = await bumpRateLimit(uid);
    if (!rate.allowed) {
      return Response.json(
        {
          error: "Too many messages this hour. Use “Email the team” or try again later.",
          code: "RATE_LIMIT",
        },
        { status: 429 }
      );
    }

    const llmMessages = [
      { role: "system" as const, content: buildSupportSystemPrompt() },
      ...messages,
    ];
    if (pagePath) {
      llmMessages.push({
        role: "system" as const,
        content: `User is on page path: ${pagePath}`,
      });
    }

    const result = await invokeLlmChat({
      messages: llmMessages,
      response_json_schema: {
        type: "object",
        properties: {
          reply: { type: "string" },
          suggestHuman: { type: "boolean" },
        },
        required: ["reply", "suggestHuman"],
      },
    });

    const parsed = typeof result === "object" && result ? result : { reply: String(result), suggestHuman: false };
    const reply = String(parsed.reply || "").trim() || "I’m not sure — try “Email the team” and we’ll get back to you.";
    const suggestHuman = Boolean(parsed.suggestHuman);

    return Response.json({
      ok: true,
      reply,
      suggestHuman,
      remaining: rate.remaining,
    });
  } catch (error) {
    console.error("[supportChat]", (error as Error)?.message || error);
    return Response.json(
      { error: (error as Error).message || "Support assistant unavailable." },
      { status: 500 }
    );
  }
}

serveWithCors(handler);
