import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { buildGenerateCampaignPrompt } from "../../shared/aiPrompts.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body || !body.song || !body.song.title) {
      return Response.json({ error: 'Song is required' }, { status: 400 });
    }
    const durationDays = Number(body.durationDays) || 7;
    if (![7, 14, 30].includes(durationDays)) {
      return Response.json({ error: 'durationDays must be 7, 14 or 30' }, { status: 400 });
    }

    const { prompt, schema } = buildGenerateCampaignPrompt({
      song: body.song,
      analysis: body.analysis,
      goals: body.goals,
      durationDays,
      startDate: body.startDate,
      releaseDate: body.releaseDate,
      promoStyle: body.promoStyle,
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
