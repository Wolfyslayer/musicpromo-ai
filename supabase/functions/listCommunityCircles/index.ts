import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";

async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = serviceClient();
    const { data: memberships } = await admin
      .from("community_circle_members")
      .select("circle_id, role, joined_at")
      .eq("user_id", user.id);

    const circleIds = (memberships || []).map((m) => m.circle_id);
    if (!circleIds.length) {
      return Response.json({ ok: true, circles: [] });
    }

    const { data: circles } = await admin
      .from("community_circles")
      .select("id, name, invite_code, max_members, owner_id, created_at")
      .in("id", circleIds);

    const counts = await Promise.all(
      circleIds.map(async (id) => {
        const { count } = await admin
          .from("community_circle_members")
          .select("user_id", { count: "exact", head: true })
          .eq("circle_id", id);
        return [id, count || 0] as const;
      })
    );
    const countMap = Object.fromEntries(counts);

    const roleMap = Object.fromEntries(
      (memberships || []).map((m) => [String(m.circle_id), m.role])
    );

    return Response.json({
      ok: true,
      circles: (circles || []).map((c) => ({
        id: c.id,
        name: c.name,
        inviteCode: c.invite_code,
        maxMembers: c.max_members,
        memberCount: countMap[String(c.id)] || 0,
        role: roleMap[String(c.id)] || "member",
        isOwner: c.owner_id === user.id,
        createdAt: c.created_at,
      })),
    });
  } catch (error) {
    console.error("[listCommunityCircles]", (error as Error)?.message || error);
    return Response.json({ error: "Could not load circles." }, { status: 500 });
  }
}

serveWithCors(handler);
