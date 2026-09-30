import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { buildAnalyzeSongPrompt } from "../../shared/aiPrompts.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body || !body.title) {
      return Response.json({ error: 'Song title is required' }, { status: 400 });
    }

    const { prompt, schema } = buildAnalyzeSongPrompt(body);
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: schema,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
