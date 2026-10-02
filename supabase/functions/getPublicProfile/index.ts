import { serveWithCors } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/runtime.ts";
import { enrichArtistRowWithSocials } from "../_shared/artistSocialUrls.ts";

function unpackArtist(row: Record<string, unknown>) {
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  return { ...data, id: row.id };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Public profile card for community discovery (no secrets).
 * Body or query: userId — UUID or lowercase handle.
 */
async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    let profileKey = url.searchParams.get("userId") || "";
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.userId) profileKey = String(body.userId);
    }
    profileKey = String(profileKey || "").trim();
    if (!profileKey) {
      return Response.json({ error: "userId is required." }, { status: 400 });
    }

    const admin = serviceClient();
    let userQuery = admin
      .from("users")
      .select(
        "id, display_name, full_name, handle, avatar_url, bio, profile_public, hide_artists_on_profile"
      );

    if (UUID_RE.test(profileKey)) {
      userQuery = userQuery.eq("id", profileKey);
    } else {
      userQuery = userQuery.eq("handle", profileKey.toLowerCase());
    }

    const { data: userRow, error: userErr } = await userQuery.maybeSingle();
    const userId = userRow?.id ? String(userRow.id) : "";

    if (userErr) throw new Error(userErr.message);
    if (!userRow || !userId || userRow.profile_public !== true) {
      return Response.json({ ok: false, code: "PRIVATE" }, { status: 404 });
    }

    const { data: artistRows } = await admin
      .from("prepared_media")
      .select("*")
      .eq("user_id", userId)
      .eq("kind", "artist");

    const artists = (artistRows || [])
      .map(unpackArtist)
      .filter((a) => a.is_demo !== true && a.show_on_public_profile !== false)
      .map((a) => ({
        id: a.id,
        name: a.name,
        genre: a.genre || null,
        biography: a.biography || null,
        profile_image: a.profile_image || null,
        location: a.location || null,
        spotify_url: a.spotify_url || null,
        youtube_url: a.youtube_url || null,
        tiktok_url: a.tiktok_url || null,
        instagram_url: a.instagram_url || null,
        facebook_url: a.facebook_url || null,
        twitter_url: a.twitter_url || null,
        website: a.website || null,
      }));

    const { data: socialRows } = await admin
      .from("social_accounts")
      .select("*")
      .eq("user_id", userId);

    const socialByArtist: Record<string, Array<Record<string, unknown>>> = {};
    for (const row of socialRows || []) {
      const payload =
        row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
      if (String(payload.status || "") !== "connected") continue;
      const artistKey = String(payload.artist_id || "_account");
      const entry = {
        provider: payload.provider || row.platform,
        username: payload.username || null,
        accountName: payload.account_name || null,
        profileImageUrl: payload.profile_image_url || null,
      };
      if (!socialByArtist[artistKey]) socialByArtist[artistKey] = [];
      socialByArtist[artistKey].push(entry);
    }

    const displayName =
      userRow.display_name || userRow.full_name || "Artist";

    const artistsForProfile =
      userRow.hide_artists_on_profile === true
        ? []
        : artists.map((a) =>
            enrichArtistRowWithSocials(
              a as Record<string, unknown>,
              socialByArtist[String(a.id)] || []
            )
          );

    return Response.json({
      ok: true,
      profile: {
        id: userRow.id,
        handle: userRow.handle || null,
        displayName,
        avatarUrl: userRow.avatar_url || null,
        bio: userRow.bio || null,
        hideArtists: userRow.hide_artists_on_profile === true,
        artists: artistsForProfile,
        connectedSocials: socialByArtist,
      },
    });
  } catch (error) {
    console.error("[getPublicProfile]", (error as Error)?.message || error);
    return Response.json({ error: "Could not load profile." }, { status: 500 });
  }
}

serveWithCors(handler);
