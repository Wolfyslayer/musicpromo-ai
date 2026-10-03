import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";

function unpackArtist(row: Record<string, unknown>) {
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  return { ...data, id: row.id, user_id: row.user_id };
}

/**
 * Signed-in artists browse public profiles for community discovery.
 */
async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = serviceClient();
    const { data: userRows, error: userErr } = await admin
      .from("users")
      .select("id, display_name, full_name, handle, avatar_url, bio, hide_artists_on_profile, created_at")
      .eq("profile_public", true)
      .order("created_at", { ascending: false })
      .limit(120);

    if (userErr) throw new Error(userErr.message);

    const publicUsers = userRows || [];
    const userIds = publicUsers.map((u) => u.id);
    if (!userIds.length) {
      return Response.json({ ok: true, members: [] });
    }

    const { data: artistRows } = await admin
      .from("prepared_media")
      .select("user_id, data, id")
      .eq("kind", "artist")
      .in("user_id", userIds);

    const artistsByUser: Record<string, Array<Record<string, unknown>>> = {};
    for (const row of artistRows || []) {
      const a = unpackArtist(row as Record<string, unknown>);
      if (a.is_demo === true || a.show_on_public_profile === false) continue;
      const uid = String(row.user_id || "");
      if (!uid) continue;
      if (!artistsByUser[uid]) artistsByUser[uid] = [];
      artistsByUser[uid].push({
        id: a.id,
        name: a.name,
        genre: a.genre || null,
        instagram_url: a.instagram_url || null,
        tiktok_url: a.tiktok_url || null,
        youtube_url: a.youtube_url || null,
        spotify_url: a.spotify_url || null,
        facebook_url: a.facebook_url || null,
        twitter_url: a.twitter_url || null,
        website: a.website || null,
      });
    }

    const members = publicUsers.map((u) => ({
      id: u.id,
      handle: u.handle || null,
      displayName: u.display_name || u.full_name || "Artist",
      avatarUrl: u.avatar_url || null,
      bio: u.bio || null,
      isSelf: u.id === user.id,
      artists: u.hide_artists_on_profile ? [] : artistsByUser[u.id] || [],
    }));

    return Response.json({ ok: true, members });
  } catch (error) {
    console.error("[listCommunityProfiles]", (error as Error)?.message || error);
    return Response.json({ error: "Could not load community." }, { status: 500 });
  }
}

serveWithCors(handler);
