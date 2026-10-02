import { createClientFromRequest } from "../_shared/runtime.ts";
import { attachClientRenderedVideo } from "../_shared/videoRender.ts";
import { isPublicHttpsUrl } from "../_shared/instagramPublishing.ts";
import { recordOwnedByUser } from "../_shared/ownership.ts";

/**
 * Called by the external render worker (not by the app).
 * Header: x-render-secret = VIDEO_RENDER_WORKER_SECRET (deploy with verify_jwt = false).
 * Body: { projectId, status: "rendering" | "complete" | "failed", progress?, videoUrl?, error?, jobId? }
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["rendering", "complete", "failed"]);

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(provided), digest(expected)]);
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ (b[i] ?? 0);
  return diff === 0;
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("VIDEO_RENDER_WORKER_SECRET") || "";
  if (!expected) {
    return json({ ok: false, code: "RENDER_WORKER_NOT_CONFIGURED", error: "VIDEO_RENDER_WORKER_SECRET is not set." }, 503);
  }
  const provided = req.headers.get("x-render-secret") || "";
  if (!provided || !(await secretsMatch(provided, expected))) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const projectId = String(body.projectId || "");
    const status = String(body.status || "");
    if (!UUID.test(projectId)) return json({ ok: false, error: "projectId must be a UUID." }, 400);
    if (!STATUSES.has(status)) {
      return json({ ok: false, error: "status must be rendering, complete or failed." }, 400);
    }

    const videoUrl = String(body.videoUrl || "").trim();
    if (status === "complete" && !isPublicHttpsUrl(videoUrl)) {
      return json({ ok: false, error: "videoUrl must be a public HTTPS URL when status is complete." }, 400);
    }

    const base44 = createClientFromRequest(req);
    const projects = base44.asServiceRole.entities.VideoProject;
    const project = await projects.get(projectId).catch(() => null);
    if (!project) return json({ ok: false, error: "Video project not found." }, 404);

    const jobId = String(body.jobId || "");
    if (jobId && project.render_job_id && String(project.render_job_id) !== jobId) {
      return json({ ok: true, ignored: true, reason: "stale_job" });
    }
    if (project.rendering_status === "complete" && status !== "complete") {
      return json({ ok: true, ignored: true, reason: "already_complete" });
    }

    const now = new Date().toISOString();
    const progress = Math.round(Math.min(100, Math.max(0, Number(body.progress) || 0)));

    if (status === "rendering") {
      await projects.update(projectId, {
        rendering_status: "rendering",
        render_progress: Math.min(99, progress),
        render_error: null,
      });
      return json({ ok: true, status });
    }

    if (status === "failed") {
      await projects.update(projectId, {
        rendering_status: "failed",
        render_error: String(body.error || "The render worker could not finish this video.").slice(0, 500),
        render_completed_at: now,
      });
      return json({ ok: true, status });
    }

    await projects.update(projectId, {
      rendering_status: "complete",
      render_progress: 100,
      render_error: null,
      render_output_url: videoUrl,
      public_url: videoUrl,
      status: "ready",
      resolution: "1080x1920",
      aspect_ratio: "9:16",
      output_format: "mp4",
      render_completed_at: now,
    });

    const campaignId = String(project.campaign_id || "");
    let campaignLink: Record<string, unknown> | null = null;
    if (campaignId && project.user_id) {
      const ownerId = String(project.user_id);
      const campaign = await base44.asServiceRole.entities.Campaign.get(campaignId).catch(() => null);
      if (!recordOwnedByUser(campaign, { id: ownerId })) {
        campaignLink = { ok: false, linked: 0, errors: ["campaign_not_owned"] };
      } else {
        const attached = await attachClientRenderedVideo({
          base44,
          campaignId,
          userId: ownerId,
          videoUrl,
        });
        campaignLink = { ok: attached.ok, linked: attached.linked, errors: attached.errors };
        if (!attached.ok) {
          console.warn("[renderVideoCallback] campaign link", attached.errors.join(", "));
        }
      }
    }

    return json({ ok: true, status, campaignLink });
  } catch (error) {
    console.error("[renderVideoCallback]", (error as Error)?.message || error);
    return json({ ok: false, error: "Could not record the render result." }, 500);
  }
}

Deno.serve(handler);
