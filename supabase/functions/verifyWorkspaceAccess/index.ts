import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";

/** Confirm caller may act as ownerUserId (studio manager). */
async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const ownerUserId = String(body?.ownerUserId || "").trim();
    if (!ownerUserId) {
      return Response.json({ error: "ownerUserId required.", code: "VALIDATION" }, { status: 400 });
    }
    if (ownerUserId === user.id) {
      return Response.json({ ok: true, allowed: true, role: "self" });
    }

    const admin = serviceClient();
    const { data: studios } = await admin
      .from("workspace_studios")
      .select("id")
      .eq("owner_id", ownerUserId);
    const studioIds = (studios || []).map((s) => s.id);
    if (!studioIds.length) {
      return Response.json({ ok: true, allowed: false });
    }

    const { data: member } = await admin
      .from("workspace_studio_members")
      .select("role")
      .eq("user_id", user.id)
      .in("studio_id", studioIds)
      .maybeSingle();

    const allowed = member?.role === "owner" || member?.role === "manager";
    return Response.json({ ok: true, allowed, role: member?.role || null });
  } catch (error) {
    console.error("[verifyWorkspaceAccess]", (error as Error)?.message || error);
    return Response.json({ error: "Could not verify access." }, { status: 500 });
  }
}

serveWithCors(handler);
