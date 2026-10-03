import { serviceClient } from "../_shared/runtime.ts";

function unpackCampaign(row: Record<string, unknown>) {
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  return { ...data, id: row.id, user_id: row.user_id, updated_at: row.updated_at, created_at: row.created_at };
}

type Admin = ReturnType<typeof serviceClient>;

export async function buildFeedItemsForUsers(
  admin: Admin,
  userIds: string[],
  userMap: Map<string, Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  const items: Array<Record<string, unknown>> = [];
  if (!userIds.length) return items;

  const { data: campaignRows } = await admin
    .from("campaign_days")
    .select("id, user_id, data, updated_at, created_at")
    .eq("kind", "campaign")
    .in("user_id", userIds);

  for (const row of campaignRows || []) {
    const c = unpackCampaign(row as Record<string, unknown>);
    const uid = String(row.user_id || "");
    const author = userMap.get(uid);
    if (!author) continue;
    const status = String(c.status || "");
    if (!["active", "scheduled", "preparing"].includes(status)) continue;

    if (c.launch_week_cross_promo === true) {
      items.push({
        type: "cross_promo",
        at: row.updated_at || row.created_at,
        user: author,
        campaign: {
          id: c.id,
          status,
          title: c.name || c.title || "Campaign",
          teaser: c.community_teaser || c.summary || "",
          artworkUrl: c.artwork_url || c.cover_url || null,
        },
        message: "Open to launch-week cross-promo",
      });
    }

    if (c.share_on_community === true) {
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
  }

  items.sort((a, b) => Date.parse(String(b.at || 0)) - Date.parse(String(a.at || 0)));
  return items.slice(0, 40);
}
