import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest } from "../_shared/runtime.ts";
import { kickCampaignWorkerSync } from "../_shared/kickCampaignWorker.ts";

/**
 * Authenticated nudge to process due scheduled SocialPosts immediately.
 * Posts stay in status=scheduled until scheduled_at; the worker publishes when due.
 */
async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const res = await kickCampaignWorkerSync({
      skipVideo: body?.skipVideo !== false,
      skipStats: body?.skipStats !== false,
      batchLimit: Math.min(20, Math.max(1, Number(body?.batchLimit) || 12)),
    });

    if (!res) {
      return Response.json(
        { ok: false, error: "Worker is not configured on the server." },
        { status: 503 }
      );
    }

    const summary = await res.json().catch(() => ({}));
    return Response.json({
      ok: res.ok,
      worker: summary,
    });
  } catch (error) {
    console.error("[kickCampaignWorker]", (error as Error)?.message || error);
    return Response.json({ error: "Could not run publish worker." }, { status: 500 });
  }
}

serveWithCors(handler);
