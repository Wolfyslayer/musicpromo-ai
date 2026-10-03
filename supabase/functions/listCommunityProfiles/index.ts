import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { secrets } from "../_shared/runtime.ts";

function unpackArtist(row: Record<string, unknown>) {
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  return { ...data, id: row.id, user_id: row.user_id };
}

const SOCIAL_KEYS = [
  "instagram_url",
  "tiktok_url",
  "youtube_url",
  "spotify_url",
  "facebook_url",
  "twitter_url",
  "website",
] as const;

function parseSpotlightHandles(): Set<string> {
  const raw = secrets.get("COMMUNITY_SPOTLIGHT_HANDLES") || "";
  const set = new Set<string>();
  for (const part of raw.split(/[,\s]+/)) {
    const h = part.trim().toLowerCase().replace(/^@+/, "");
    if (h) set.add(h);
  }
  return set;
}

function buildMember(
  u: Record<string, unknown>,
  artistsByUser: Record<string, Array<Record<string, unknown>>>,
  viewerId: string,
  followingSet: Set<string>
) {
  const artists = u.hide_artists_on_profile ? [] : artistsByUser[String(u.id)] || [];
  const genres = [
    ...new Set(
      artists.map((a) => (a.genre ? String(a.genre).trim() : "")).filter(Boolean)
    ),
  ];
  let socialLinkCount = 0;
  for (const a of artists) {
    for (const key of SOCIAL_KEYS) {
      if (String(a[key] || "").trim()) socialLinkCount += 1;
    }
  }
  const lastActiveAt =
    String(u.last_active_at || u.created_at || "") || null;
  return {
    id: u.id,
    handle: u.handle || null,
    displayName: u.display_name || u.full_name || "Artist",
    avatarUrl: u.avatar_url || null,
    bio: u.bio || null,
    memberSince: u.created_at || null,
    lastActiveAt,
    communityFeatured: u.community_featured === true,
    isSelf: u.id === viewerId,
    isFollowing: followingSet.has(String(u.id)),
    artistCount: artists.length,
    socialLinkCount,
    genres,
    artists,
  };
}

function toSpotlightCard(member: Record<string, unknown>) {
  return {
    id: member.id,
    handle: member.handle,
    displayName: member.displayName,
    avatarUrl: member.avatarUrl,
    bio: member.bio,
    isSelf: member.isSelf,
    genres: (member.genres as string[])?.slice(0, 2) || [],
  };
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
    const nowIso = new Date().toISOString();
    admin
      .from("users")
      .update({ last_active_at: nowIso })
      .eq("id", user.id)
      .then(() => {})
      .catch(() => {});

    const { data: userRows, error: userErr } = await admin
      .from("users")
      .select(
        "id, display_name, full_name, handle, avatar_url, bio, hide_artists_on_profile, created_at, community_featured, last_active_at"
      )
      .eq("profile_public", true)
      .order("created_at", { ascending: false })
      .limit(120);

    if (userErr) throw new Error(userErr.message);

    const publicUsers = userRows || [];
    const userIds = publicUsers.map((u) => u.id);

    const { data: followRows } = await admin
      .from("community_follows")
      .select("followed_user_id")
      .eq("follower_id", user.id);
    const followingSet = new Set(
      (followRows || []).map((r) => String(r.followed_user_id))
    );
    const followingIds = [...followingSet];

    if (!userIds.length) {
      return Response.json({
        ok: true,
        members: [],
        followingIds,
        spotlight: { featured: [], recentlyActive: [] },
      });
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

    const members = publicUsers.map((u) =>
      buildMember(u as Record<string, unknown>, artistsByUser, user.id, followingSet)
    );

    const handleSpotlight = parseSpotlightHandles();
    const featured: typeof members = [];
    const featuredIds = new Set<string>();

    for (const m of members) {
      const handleMatch =
        m.handle && handleSpotlight.has(String(m.handle).toLowerCase());
      if (m.communityFeatured || handleMatch) {
        featured.push(m);
        featuredIds.add(String(m.id));
      }
    }

    const recentlyActive = [...members]
      .filter((m) => !featuredIds.has(String(m.id)) && !m.isSelf)
      .sort(
        (a, b) =>
          Date.parse(String(b.lastActiveAt || 0)) -
            Date.parse(String(a.lastActiveAt || 0)) ||
          String(a.displayName).localeCompare(String(b.displayName))
      )
      .slice(0, 8);

    return Response.json({
      ok: true,
      members,
      followingIds,
      spotlight: {
        featured: featured.slice(0, 8).map(toSpotlightCard),
        recentlyActive: recentlyActive.map(toSpotlightCard),
      },
    });
  } catch (error) {
    console.error("[listCommunityProfiles]", (error as Error)?.message || error);
    return Response.json({ error: "Could not load community." }, { status: 500 });
  }
}

serveWithCors(handler);
