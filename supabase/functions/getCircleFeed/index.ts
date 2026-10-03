import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { buildFeedItemsForUsers } from "../_shared/communityFeedItems.ts";

async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const circleId = String(body?.circleId || url.searchParams.get("circleId") || "").trim();
    if (!circleId) {
      return Response.json({ error: "circleId is required.", code: "VALIDATION" }, { status: 400 });
    }

    const admin = serviceClient();
    const { data: membership } = await admin
      .from("community_circle_members")
      .select("circle_id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership?.circle_id) {
      return Response.json({ error: "Not a member of this circle.", code: "FORBIDDEN" }, { status: 403 });
    }

    const { data: memberRows } = await admin
      .from("community_circle_members")
      .select("user_id")
      .eq("circle_id", circleId);

    const memberIds = (memberRows || []).map((r) => String(r.user_id)).filter((id) => id !== user.id);
    if (!memberIds.length) {
      return Response.json({ ok: true, items: [] });
    }

    const { data: users } = await admin
      .from("users")
      .select("id, display_name, full_name, handle, avatar_url")
      .in("id", memberIds)
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

    const items = await buildFeedItemsForUsers(admin, [...userMap.keys()], userMap);
    return Response.json({ ok: true, items });
  } catch (error) {
    console.error("[getCircleFeed]", (error as Error)?.message || error);
    return Response.json({ error: "Could not load circle feed." }, { status: 500 });
  }
}

serveWithCors(handler);
