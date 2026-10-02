import { createClientFromRequest } from "../_shared/runtime.ts";
import { recordOwnedByUser } from "../_shared/ownership.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";
import { isPublicHttpsUrl } from "../_shared/instagramPublishing.ts";

/**
 * Queue a server-side promo render for a VideoProject.
 *
 * Body: {
 *   projectId, artworkUrl, audioUrl, duration, look, title, artistName, text, lyrics,
 *   visualStyle, particleEffect, lyricCues, audioStartTimeOffset, videoType, outroCta, campaignId?
 * }
 *
 * Secrets: VIDEO_RENDER_WORKER_URL, VIDEO_RENDER_WORKER_SECRET.
 * The worker reports back to `renderVideoCallback` (see docs/VIDEO_RENDER_WORKER.md).
 */

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 60;
const OUTPUT_BUCKET = "music-promo-assets";
const MAX_CUES = 400;
const VISUAL_STYLES = new Set(["pop", "hiphop", "rock"]);
const PARTICLE_EFFECTS = new Set([
  "none", "stardust", "smoke", "sparks", "leaks", "vhs", "neon",
  "vinyl", "rings", "shake", "prism", "fluid", "grain",
]);
const VIDEO_TYPES = new Set(["lyrics", "promo"]);
const FONT_IDS = new Set(["sans", "display", "grunge"]);

type Json = Record<string, unknown>;

function text(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function num(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return true;
  }
  if (host.startsWith("[") || host.includes(":")) return true;
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  );
}

function assetUrl(value: unknown): string {
  const url = text(value, 2048);
  if (!url || !isPublicHttpsUrl(url)) return "";
  try {
    return isBlockedHost(new URL(url).hostname) ? "" : url;
  } catch {
    return "";
  }
}

function sanitizeLook(value: unknown): Json {
  const src = value && typeof value === "object" ? (value as Json) : {};
  const color = /^#[0-9a-fA-F]{6}$/.test(String(src.textColor || "")) ? String(src.textColor) : "#f2ecff";
  return {
    fontId: FONT_IDS.has(String(src.fontId)) ? String(src.fontId) : "sans",
    fontSize: Math.round(num(src.fontSize, 36, 96, 64)),
    textColor: color,
    letterSpacing: num(src.letterSpacing, -2, 16, 0),
    animationMs: Math.round(num(src.animationMs, 80, 900, 280)),
    lyricX: num(src.lyricX, 8, 92, 50),
    lyricY: num(src.lyricY, 8, 92, 82),
    particleX: num(src.particleX, 0, 100, 50),
    particleY: num(src.particleY, 0, 100, 88),
    wind: num(src.wind, -1, 1, 0.25),
    particleSpeed: num(src.particleSpeed, 0.1, 1, 0.45),
  };
}

function sanitizeCues(value: unknown): Array<{ text: string; start: number; end: number; timeSeconds: number }> {
  if (!Array.isArray(value)) return [];
  const cues = [];
  for (const raw of value.slice(0, MAX_CUES)) {
    const cue = raw && typeof raw === "object" ? (raw as Json) : {};
    const line = text(cue.text, 240);
    if (!line) continue;
    const start = num(cue.timeSeconds ?? cue.start, 0, 3600, 0);
    const end = Math.max(start, num(cue.end, 0, 3600, start));
    cues.push({
      text: line,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      timeSeconds: Number(start.toFixed(3)),
    });
  }
  return cues;
}

function workerConfig(): { url: string; secret: string } | null {
  const url = (Deno.env.get("VIDEO_RENDER_WORKER_URL") || "").trim();
  const secret = Deno.env.get("VIDEO_RENDER_WORKER_SECRET") || "";
  if (!url || !secret) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return { url, secret };
}

async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return jsonWithCors(req, { error: "Unauthorized" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as Json;
    const projectId = text(body.projectId, 64);
    if (!projectId) {
      return jsonWithCors(req, { ok: false, error: "projectId is required.", code: "INVALID_INPUT" }, 400);
    }

    const projects = base44.asServiceRole.entities.VideoProject;
    const project = await projects.get(projectId).catch(() => null);
    if (!project) {
      return jsonWithCors(req, { error: "Video project not found." }, 404);
    }
    if (!recordOwnedByUser(project, user)) {
      return jsonWithCors(req, { error: "Forbidden" }, 403);
    }

    const artworkUrl = assetUrl(body.artworkUrl);
    const audioUrl = assetUrl(body.audioUrl);
    if (!artworkUrl) {
      return jsonWithCors(
        req,
        { ok: false, error: "artworkUrl must be a public HTTPS URL.", code: "INVALID_ARTWORK_URL" },
        400
      );
    }
    if (!audioUrl) {
      return jsonWithCors(
        req,
        { ok: false, error: "audioUrl must be a public HTTPS URL.", code: "INVALID_AUDIO_URL" },
        400
      );
    }

    const videoType = VIDEO_TYPES.has(String(body.videoType)) ? String(body.videoType) : "promo";
    const duration = Math.round(num(body.duration, 4, 600, 15));
    const visualStyle = VISUAL_STYLES.has(String(body.visualStyle)) ? String(body.visualStyle) : "pop";
    const particleEffect = PARTICLE_EFFECTS.has(String(body.particleEffect)) ? String(body.particleEffect) : "none";
    const campaignId = text(project.campaign_id || body.campaignId, 64) || null;

    const job = {
      artworkUrl,
      audioUrl,
      duration,
      look: sanitizeLook(body.look),
      title: text(body.title, 160),
      artistName: text(body.artistName, 160),
      text: text(body.text, 400),
      lyrics: text(body.lyrics, 8000),
      visualStyle,
      particleEffect,
      lyricCues: sanitizeCues(body.lyricCues),
      audioStartTimeOffset: num(body.audioStartTimeOffset, 0, 3600, 0),
      videoType,
      outroCta: text(body.outroCta, 80),
    };

    const config = workerConfig();
    if (!config) {
      const message = "Video rendering is not configured on the server yet. Set VIDEO_RENDER_WORKER_URL and VIDEO_RENDER_WORKER_SECRET.";
      await projects
        .update(projectId, {
          rendering_status: "failed",
          render_progress: 0,
          render_error: message,
        })
        .catch((err: Error) => console.warn("[requestVideoRender] mark failed", err?.message || err));
      return jsonWithCors(
        req,
        { ok: false, code: "RENDER_WORKER_NOT_CONFIGURED", error: message },
        503
      );
    }

    const jobId = crypto.randomUUID();
    await projects.update(projectId, {
      rendering_status: "queued",
      render_progress: 0,
      render_error: null,
      render_job_id: jobId,
      render_requested_at: new Date().toISOString(),
      user_id: String(project.user_id || user.id),
    });

    const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
    const callbackUrl = `${supabaseUrl}/functions/v1/renderVideoCallback`;
    const workerPayload = {
      jobId,
      projectId,
      campaignId,
      userId: String(project.user_id || user.id),
      callbackUrl,
      output: {
        bucket: OUTPUT_BUCKET,
        path: `${String(project.user_id || user.id)}/video/${projectId}-${jobId}.mp4`,
        contentType: "video/mp4",
      },
      width: WIDTH,
      height: HEIGHT,
      fps: FPS,
      ...job,
    };

    let workerError = "";
    try {
      const res = await fetch(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.secret}`,
        },
        body: JSON.stringify(workerPayload),
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) {
        workerError = `Render worker rejected the job (HTTP ${res.status}).`;
        console.error("[requestVideoRender] worker", res.status, (await res.text().catch(() => "")).slice(0, 300));
      }
    } catch (err) {
      workerError = "Could not reach the render worker.";
      console.error("[requestVideoRender] worker fetch", (err as Error)?.message || err);
    }

    if (workerError) {
      await projects
        .update(projectId, { rendering_status: "failed", render_error: workerError })
        .catch(() => {});
      return jsonWithCors(req, { ok: false, code: "RENDER_WORKER_UNAVAILABLE", error: workerError }, 502);
    }

    return jsonWithCors(req, {
      ok: true,
      projectId,
      jobId,
      status: "queued",
      resolution: `${WIDTH}x${HEIGHT}`,
    });
  } catch (error) {
    console.error("[requestVideoRender]", (error as Error)?.message || error);
    return jsonWithCors(req, { error: "Could not queue the video render." }, 500);
  }
}

servePostApi(handler);
