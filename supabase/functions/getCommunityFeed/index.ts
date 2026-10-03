import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";

function unpackCampaign(row: Record<string, unknown>) {
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  return { ...data, id: row.id, user_id: row.user_id, updated_at: row.updated_at };
}

async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = serviceClient();
    const { data: followRows } = await admin
      .from("community_follows")
      .select("followed_user_id")
      .eq("follower_id", user.id);
    const followedIds = (followRows || []).map((r) => String(r.followed_user_id));
    if (!followedIds.length) {
      return Response.json({ ok: true, items: [] });
    }

    const { data: users } = await admin
      .from("users")
      .select("id, display_name, full_name, handle, avatar_url, profile_public, last_active_at")
      .in("id", followedIds)
      .eq("profile_public", true);

    const userMap = new Map(
      (users || []).map((u) => [
        String(u.id),
        {
          id: u.id,
          displayName: u.display_name || u.full_name || "Artist",
          handle: u.handle || null,
          avatarUrl: u.avatar_url || null,
        },
      ])
    );

    const items: Array<Record<string, unknown>> = [];

    const { data: campaignRows } = await admin
      .from("campaign_days")
      .select("id, user_id, data, updated_at, created_at")
      .eq("kind", "campaign")
      .in("user_id", followedIds);

    for (const row of campaignRows || []) {
      const c = unpackCampaign(row as Record<string, unknown>);
      if (c.share_on_community !== true) continue;
      const uid = String(row.user_id || "");
      const author = userMap.get(uid);
      if (!author) continue;
      const status = String(c.status || "");
      if (!["active", "scheduled", "preparing"].includes(status)) continue;
      items.push({
        type: "campaign_share",
        at: row.updated_at || row.created_at,
        user: author,
        campaign: {
          id: c.id,
          status,
          title: c.name || c.title || "Campaign",
          teaser: c.community_teaser || c.summary || "",
          artworkUrl: c.artwork_url || c.cover_url || null,
        },
      });
    }

    for (const u of users || []) {
      const activeAt = u.last_active_at;
      if (!activeAt) continue;
      const ms = Date.parse(String(activeAt));
      if (Number.isNaN(ms) || Date.now() - ms > 7 * 24 * 60 * 60 * 1000) continue;
      items.push({
        type: "profile_active",
        at: activeAt,
        user: userMap.get(String(u.id)),
        message: "Was active on Community recently",
      });
    }

    items.sort(
      (a, b) => Date.parse(String(b.at || 0)) - Date.parse(String(a.at || 0))
    );

    return Response.json({ ok: true, items: items.slice(0, 40) });
  } catch (error) {
    console.error("[getCommunityFeed]", (error as Error)?.message || error);
    return Response.json({ error: "Could not load feed." }, { status: 500 });
  }
}

serveWithCors(handler);
