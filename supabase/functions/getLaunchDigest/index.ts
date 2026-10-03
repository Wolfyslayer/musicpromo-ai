import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";

function unpackDay(row: Record<string, unknown>) {
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  return { ...data, id: row.id };
}

function unpackCampaign(row: Record<string, unknown>) {
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  return { ...data, id: row.id };
}

async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = serviceClient();
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const today = now.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const { data: profile } = await admin
      .from("users")
      .select("launch_digest_enabled, email, display_name")
      .eq("id", user.id)
      .maybeSingle();

    const { data: dayRows } = await admin
      .from("campaign_days")
      .select("id, data, campaign_id")
      .eq("user_id", user.id)
      .eq("kind", "day");

    const upcomingDays = (dayRows || [])
      .map(unpackDay)
      .filter((d) => {
        const date = String(d.date || "");
        return date >= today && date <= weekEndStr;
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 14)
      .map((d) => ({
        id: d.id,
        date: d.date,
        dayNumber: d.day_number,
        caption: d.caption || d.theme || "",
        status: d.status || "pending",
        scheduledAt: d.scheduled_at || null,
      }));

    const { data: campaignRows } = await admin
      .from("campaign_days")
      .select("id, data")
      .eq("user_id", user.id)
      .eq("kind", "campaign");

    const activeCampaigns = (campaignRows || [])
      .map(unpackCampaign)
      .filter((c) => ["active", "scheduled", "preparing"].includes(String(c.status || "")))
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        title: c.name || c.title || "Campaign",
        status: c.status,
        shareOnCommunity: c.share_on_community === true,
      }));

    const { count: pendingPromo } = await admin
      .from("community_promo_requests")
      .select("id", { count: "exact", head: true })
      .eq("target_user_id", user.id)
      .eq("status", "pending");

    const issues = upcomingDays.filter(
      (d) => !String(d.caption || "").trim() || (d.status !== "scheduled" && d.status !== "complete")
    ).length;

    return Response.json({
      ok: true,
      digest: {
        weekLabel: `${today} → ${weekEndStr}`,
        upcomingDays,
        activeCampaigns,
        pendingPromoRequests: pendingPromo || 0,
        attentionCount: issues,
        digestEnabled: profile?.launch_digest_enabled !== false,
        email: profile?.email || null,
      },
    });
  } catch (error) {
    console.error("[getLaunchDigest]", (error as Error)?.message || error);
    return Response.json({ error: "Could not build digest." }, { status: 500 });
  }
}

serveWithCors(handler);
