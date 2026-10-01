import { createClientFromRequest } from "../_shared/runtime.ts";
import { buildContentPrompt } from "../_shared/aiPrompts.ts";

async function handler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body || !body.song || !body.contentType) {
      return Response.json({ error: 'song and contentType are required' }, { status: 400 });
    }

    const { prompt, schema } = buildContentPrompt({
      song: body.song,
      analysis: body.analysis,
      platform: body.platform,
      contentType: body.contentType,
      campaignGoals: body.campaignGoals,
    });
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: schema,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}


Deno.serve(handler);
