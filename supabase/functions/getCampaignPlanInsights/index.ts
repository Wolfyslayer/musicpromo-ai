import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest } from "../_shared/runtime.ts";
import { recordOwnedByUser } from "../_shared/ownership.ts";
import { studioCanAccessOwner } from "../_shared/workspaceAccess.ts";

function engagementScore(row: Record<string, unknown>) {
  return (
    Number(row.views || 0) +
    Number(row.likes || 0) * 2 +
    Number(row.comments || 0) * 3 +
    Number(row.shares || 0) * 4 +
    Number(row.saves || 0) * 2
  );
}

function unpackDay(row: Record<string, unknown>) {
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  return { ...data, id: row.id };
}

/**
 * Rules-based performance → plan suggestions for one campaign.
 * Body: { campaignId }
 */
async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const campaignId = String(body?.campaignId || "").trim();
    if (!campaignId) {
      return Response.json({ error: "campaignId is required.", code: "VALIDATION" }, { status: 400 });
    }

    let campaign: Record<string, unknown> | null = null;
    try {
      campaign = await base44.asServiceRole.entities.Campaign.get(campaignId);
    } catch {
      campaign = null;
    }
    const ownerId = campaign?.user_id != null ? String(campaign.user_id) : "";
    const allowed =
      campaign &&
      (recordOwnedByUser(campaign, user) ||
        (ownerId ? await studioCanAccessOwner(String(user.id), ownerId) : false));
    if (!allowed) {
      return Response.json({ error: "Campaign not found.", code: "NOT_FOUND" }, { status: 404 });
    }

    const [analytics, days, posts] = await Promise.all([
      base44.asServiceRole.entities.AnalyticsEntry.filter({ campaign_id: campaignId }, "-date", 120).catch(
        () => []
      ),
      base44.asServiceRole.entities.CampaignDay.filter({ campaign_id: campaignId }, "day_number", 120).catch(
        () => []
      ),
      base44.asServiceRole.entities.SocialPost.filter({ campaign_id: campaignId }, "-created_date", 120).catch(
        () => []
      ),
    ]);

    const analyticsRows = (analytics || []).filter((a: Record<string, unknown>) => a.is_demo !== true);
    const dayRows = (days || []).map(unpackDay);
    const postRows = posts || [];

    const postToDay = new Map<string, string>();
    for (const p of postRows) {
      const dayId = p.campaign_day_id ? String(p.campaign_day_id) : "";
      if (p.id && dayId) postToDay.set(String(p.id), dayId);
    }

    const byPlatform: Record<string, number> = {};
    const byContentType: Record<string, number> = {};
    const byDay: Record<string, number> = {};

    for (const a of analyticsRows) {
      const score = engagementScore(a);
      const platform = String(a.platform || "Unknown");
      const ctype = String(a.content_type || "Post");
      byPlatform[platform] = (byPlatform[platform] || 0) + score;
      byContentType[ctype] = (byContentType[ctype] || 0) + score;

      const socialPostId = a.social_post_id ? String(a.social_post_id) : "";
      const dayId = socialPostId ? postToDay.get(socialPostId) : "";
      if (dayId) {
        byDay[dayId] = (byDay[dayId] || 0) + score;
      }
    }

    const topPlatform = Object.entries(byPlatform).sort((a, b) => b[1] - a[1])[0];
    const topType = Object.entries(byContentType).sort((a, b) => b[1] - a[1])[0];
    const topDayEntry = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];

    const suggestions: Array<Record<string, unknown>> = [];

    if (topPlatform && topPlatform[1] > 0) {
      suggestions.push({
        id: "double-down-platform",
        kind: "platform",
        title: `Lean into ${topPlatform[0]}`,
        detail: `${topPlatform[0]} drove the strongest engagement in logged analytics. Schedule your next high-effort post there.`,
        platform: topPlatform[0],
      });
    }

    if (topType && topType[1] > 0) {
      suggestions.push({
        id: "double-down-format",
        kind: "format",
        title: `Repeat "${topType[0]}" format`,
        detail: `This content type outperformed others. Mirror its hook and CTA on upcoming plan days.`,
        contentType: topType[0],
      });
    }

    if (topDayEntry) {
      const day = dayRows.find((d) => String(d.id) === topDayEntry[0]);
      if (day) {
        suggestions.push({
          id: "clone-winning-day",
          kind: "day",
          title: `Reuse Day ${day.day_number || "?"} patterns`,
          detail: `That day's post metrics were strongest. Copy caption structure and posting time to similar upcoming days.`,
          dayId: day.id,
          dayNumber: day.day_number,
        });
      }
    }

    const upcoming = dayRows.filter((d) => !["posted", "complete", "skipped"].includes(String(d.status || "")));
    for (const day of upcoming.slice(0, 8)) {
      if (topPlatform && String(day.platform || "") !== topPlatform[0] && topPlatform[1] > 0) {
        suggestions.push({
          id: `shift-platform-${day.id}`,
          kind: "action",
          title: `Day ${day.day_number}: consider ${topPlatform[0]}`,
          detail: `Planned for ${day.platform || "another platform"} — your data favors ${topPlatform[0]}.`,
          dayId: day.id,
          suggestedPlatform: topPlatform[0],
        });
      }
      if (!String(day.caption || "").trim()) {
        suggestions.push({
          id: `caption-${day.id}`,
          kind: "fix",
          title: `Day ${day.day_number}: add caption`,
          detail: "Empty captions underperform when you do publish — draft copy before scheduling.",
          dayId: day.id,
        });
      }
    }

    const deduped = suggestions.filter(
      (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i
    );

    return Response.json({
      ok: true,
      summary: {
        analyticsCount: analyticsRows.length,
        topPlatform: topPlatform ? { name: topPlatform[0], score: topPlatform[1] } : null,
        topContentType: topType ? { name: topType[0], score: topType[1] } : null,
        bestDayId: topDayEntry ? topDayEntry[0] : null,
      },
      suggestions: deduped.slice(0, 12),
    });
  } catch (error) {
    console.error("[getCampaignPlanInsights]", (error as Error)?.message || error);
    return Response.json({ error: "Could not build plan insights." }, { status: 500 });
  }
}

serveWithCors(handler);
