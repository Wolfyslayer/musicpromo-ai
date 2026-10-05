import { serveWithCors } from "../_shared/cors.ts";

/**
 * TemPolor song-generation webhook (required callback_url on /open-apis/v1/song/generate).
 * We poll task status in generateSunoTrack; this endpoint only needs to acknowledge callbacks.
 * Docs: https://platform.tempolor.com/docs/296524440e0
 */
async function handler(req: Request): Promise<Response> {
  if (req.method === "POST") {
    try {
      await req.json().catch(() => ({}));
    } catch {
      /* ignore body parse errors */
    }
  }
  return new Response("success", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

serveWithCors(handler);
