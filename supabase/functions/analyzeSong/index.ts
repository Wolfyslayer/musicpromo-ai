import { createClientFromRequest } from "../_shared/runtime.ts";
import { buildAnalyzeSongPrompt } from "../_shared/aiPrompts.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";

async function handler(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    const body = await req.json();
    if (!body || !body.title) {
      return jsonWithCors(req, { error: "Song title is required" }, 400);
    }

    const { prompt, schema } = buildAnalyzeSongPrompt(body);
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: schema,
    });
    return jsonWithCors(req, result);
  } catch (error) {
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);
