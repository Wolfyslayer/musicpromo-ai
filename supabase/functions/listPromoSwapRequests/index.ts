import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";

function profileCard(u: Record<string, unknown> | null) {
  if (!u) return null;
  return {
    id: u.id,
    handle: u.handle || null,
    displayName: u.display_name || u.full_name || "Artist",
    avatarUrl: u.avatar_url || null,
  };
}

async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = serviceClient();
    const { data: rows } = await admin
      .from("community_promo_requests")
      .select("*")
      .or(`requester_id.eq.${user.id},target_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(50);

    const userIds = new Set<string>();
    for (const r of rows || []) {
      userIds.add(String(r.requester_id));
      userIds.add(String(r.target_user_id));
    }

    const { data: users } = await admin
      .from("users")
      .select("id, display_name, full_name, handle, avatar_url")
      .in("id", [...userIds]);

    const userMap = Object.fromEntries((users || []).map((u) => [String(u.id), u]));

    const incoming: Array<Record<string, unknown>> = [];
    const outgoing: Array<Record<string, unknown>> = [];

    for (const r of rows || []) {
      const item = {
        id: r.id,
        status: r.status,
        message: r.message,
        campaignId: r.campaign_id || null,
        createdAt: r.created_at,
        respondedAt: r.responded_at || null,
        requester: profileCard(userMap[String(r.requester_id)] as Record<string, unknown>),
        target: profileCard(userMap[String(r.target_user_id)] as Record<string, unknown>),
      };
      if (r.target_user_id === user.id) incoming.push(item);
      if (r.requester_id === user.id) outgoing.push(item);
    }

    return Response.json({
      ok: true,
      incoming,
      outgoing,
      pendingIncoming: incoming.filter((i) => i.status === "pending").length,
    });
  } catch (error) {
    console.error("[listPromoSwapRequests]", (error as Error)?.message || error);
    return Response.json({ error: "Could not load requests." }, { status: 500 });
  }
}

serveWithCors(handler);
