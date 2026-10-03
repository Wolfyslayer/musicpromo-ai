import { serveWithCors } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/runtime.ts";
import { enrichArtistRowWithSocials } from "../_shared/artistSocialUrls.ts";
import {
  computeBadges,
  computeCompleteness,
  genreToSlug,
  pickListenSource,
} from "../_shared/communityProfile.ts";

function unpackRow(row: Record<string, unknown>) {
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  return { ...data, id: row.id, user_id: row.user_id };
}

function unpackCampaign(row: Record<string, unknown>) {
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  return { ...data, id: row.id, user_id: row.user_id };
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
        "id, display_name, full_name, handle, avatar_url, bio, profile_public, hide_artists_on_profile, featured_release_id, show_active_campaign_badge, allow_public_contact, community_featured, community_verified_at, created_at"
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

    const artistRecords = (artistRows || []).map(unpackRow);
    const artists = artistRecords
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

    let featuredRelease: Record<string, unknown> | null = null;
    const featuredId = userRow.featured_release_id ? String(userRow.featured_release_id) : "";
    if (featuredId) {
      const { data: relRow } = await admin
        .from("prepared_media")
        .select("*")
        .eq("id", featuredId)
        .eq("user_id", userId)
        .eq("kind", "release")
        .maybeSingle();
      if (relRow) {
        const rel = unpackRow(relRow as Record<string, unknown>);
        featuredRelease = {
          id: rel.id,
          title: rel.title || rel.name || "Release",
          artworkUrl: rel.artwork_url || rel.cover_url || null,
          spotify_url: rel.spotify_url || null,
          youtube_url: rel.youtube_url || null,
          releaseDate: rel.release_date || null,
        };
      }
    }

    let activeCampaignLabel: string | null = null;
    if (userRow.show_active_campaign_badge === true) {
      const { data: campaignRows } = await admin
        .from("campaign_days")
        .select("data, updated_at")
        .eq("user_id", userId)
        .eq("kind", "campaign")
        .order("updated_at", { ascending: false })
        .limit(12);
      for (const row of campaignRows || []) {
        const c = unpackCampaign(row as Record<string, unknown>);
        const status = String(c.status || "");
        if (["active", "scheduled", "preparing"].includes(status)) {
          activeCampaignLabel = String(c.name || c.title || "Active campaign");
          break;
        }
      }
    }

    const badgeUser = {
      ...userRow,
      _activeCampaignLabel: activeCampaignLabel,
    } as Record<string, unknown>;

    const rawArtistsForCompleteness = artistRecords.filter(
      (a) => a.is_demo !== true && a.show_on_public_profile !== false
    );
    const completeness = computeCompleteness(badgeUser, rawArtistsForCompleteness);
    const badges = computeBadges(badgeUser);
    const listen = pickListenSource(featuredRelease, rawArtistsForCompleteness);

    const genreSlugs = [
      ...new Set(
        artists
          .map((a) => (a.genre ? genreToSlug(String(a.genre)) : ""))
          .filter(Boolean)
      ),
    ];

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

    const displayName = userRow.display_name || userRow.full_name || "Artist";

    const artistsForProfile =
      userRow.hide_artists_on_profile === true
        ? []
        : artists.map((a) =>
            enrichArtistRowWithSocials(
              a as Record<string, unknown>,
              socialByArtist[String(a.id)] || []
            )
          );

    const similarArtists: Array<Record<string, unknown>> = [];
    const genreLabels = [
      ...new Set(artists.map((a) => (a.genre ? String(a.genre).trim() : "")).filter(Boolean)),
    ];
    if (genreLabels.length) {
      const { data: peerArtistRows } = await admin
        .from("prepared_media")
        .select("user_id, data")
        .eq("kind", "artist")
        .neq("user_id", userId)
        .limit(400);

      const peerUserIds = new Set<string>();
      for (const row of peerArtistRows || []) {
        const a = unpackRow(row as Record<string, unknown>);
        if (a.is_demo === true || a.show_on_public_profile === false) continue;
        const g = a.genre ? String(a.genre).trim() : "";
        if (g && genreLabels.includes(g)) {
          peerUserIds.add(String(row.user_id || ""));
        }
      }

      const peerIds = [...peerUserIds].slice(0, 24);
      if (peerIds.length) {
        const { data: peerUsers } = await admin
          .from("users")
          .select("id, display_name, full_name, handle, avatar_url, bio")
          .in("id", peerIds)
          .eq("profile_public", true)
          .limit(8);

        for (const u of peerUsers || []) {
          similarArtists.push({
            id: u.id,
            handle: u.handle || null,
            displayName: u.display_name || u.full_name || "Artist",
            avatarUrl: u.avatar_url || null,
            bio: u.bio || null,
          });
        }
      }
    }

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
        badges,
        completeness,
        featuredRelease,
        listen,
        genreSlugs,
        openToContact: userRow.allow_public_contact === true,
        similarArtists,
      },
    });
  } catch (error) {
    console.error("[getPublicProfile]", (error as Error)?.message || error);
    return Response.json({ error: "Could not load profile." }, { status: 500 });
  }
}

serveWithCors(handler);
