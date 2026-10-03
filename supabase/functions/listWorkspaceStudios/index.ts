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
    const { data: memberRows } = await admin
      .from("workspace_studio_members")
      .select("studio_id, role")
      .eq("user_id", user.id);

    const studioIds = (memberRows || []).map((r) => r.studio_id);
    if (!studioIds.length) {
      return Response.json({ ok: true, studios: [], memberships: [] });
    }

    const { data: studios } = await admin
      .from("workspace_studios")
      .select("id, name, owner_id, created_at")
      .in("id", studioIds);

    const ownerIds = [...new Set((studios || []).map((s) => s.owner_id))];
    const { data: owners } = await admin
      .from("users")
      .select("id, display_name, full_name, email, handle")
      .in("id", ownerIds);

    const ownerMap = Object.fromEntries((owners || []).map((o) => [String(o.id), o]));

    const memberships = (memberRows || []).map((m) => {
      const studio = (studios || []).find((s) => s.id === m.studio_id);
      const owner = studio ? ownerMap[String(studio.owner_id)] : null;
      return {
        studioId: m.studio_id,
        role: m.role,
        studioName: studio?.name || "Studio",
        ownerId: studio?.owner_id,
        ownerLabel:
          owner?.display_name ||
          owner?.full_name ||
          owner?.handle ||
          owner?.email?.split("@")[0] ||
          "Owner",
        isOwnStudio: studio?.owner_id === user.id,
      };
    });

    const rosterByStudio: Record<string, Array<Record<string, unknown>>> = {};
    for (const sid of studioIds) {
      const { data: roster } = await admin
        .from("workspace_studio_members")
        .select("user_id, role, created_at")
        .eq("studio_id", sid);
      const userIds = (roster || []).map((r) => r.user_id);
      const { data: users } = userIds.length
        ? await admin.from("users").select("id, display_name, full_name, email, handle").in("id", userIds)
        : { data: [] };
      const umap = Object.fromEntries((users || []).map((u) => [String(u.id), u]));
      rosterByStudio[String(sid)] = (roster || []).map((r) => {
        const u = umap[String(r.user_id)];
        return {
          userId: r.user_id,
          role: r.role,
          displayName: u?.display_name || u?.full_name || u?.email?.split("@")[0] || "Member",
          email: u?.email || null,
          handle: u?.handle || null,
        };
      });
    }

    return Response.json({
      ok: true,
      studios: (studios || []).map((s) => ({
        id: s.id,
        name: s.name,
        ownerId: s.owner_id,
        members: rosterByStudio[String(s.id)] || [],
      })),
      memberships,
    });
  } catch (error) {
    console.error("[listWorkspaceStudios]", (error as Error)?.message || error);
    return Response.json({ error: "Could not load studios." }, { status: 500 });
  }
}

serveWithCors(handler);
