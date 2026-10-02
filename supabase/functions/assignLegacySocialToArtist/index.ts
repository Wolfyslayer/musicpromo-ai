import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";

/**
 * Attach account-wide (legacy) social connections to one artist.
 * Body: { artistId: string }
 */
async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const artistId = String(body?.artistId || "").trim();
    if (!artistId) {
      return Response.json({ error: "artistId is required." }, { status: 400 });
    }

    const artist = await base44.asServiceRole.entities.Artist.get(artistId).catch(() => null);
    if (!artist || String(artist.user_id) !== String(user.id)) {
      return Response.json({ error: "Artist not found." }, { status: 404 });
    }

    const rows =
      (await base44.asServiceRole.entities.SocialAccount.filter(
        { user_id: user.id, status: "connected" },
        "-connected_at",
        50
      )) || [];

    let updated = 0;
    for (const row of rows) {
      if (String(row.artist_id || "").trim()) continue;
      await base44.asServiceRole.entities.SocialAccount.update(String(row.id), {
        artist_id: artistId,
      });
      updated += 1;
    }

    return Response.json({ ok: true, updated });
  } catch (error) {
    console.error("[assignLegacySocialToArtist]", (error as Error)?.message || error);
    return Response.json({ error: "Could not assign social accounts." }, { status: 500 });
  }
}

serveWithCors(handler);
