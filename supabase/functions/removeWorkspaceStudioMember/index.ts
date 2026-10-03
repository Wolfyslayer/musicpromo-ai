import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";

async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const studioId = String(body?.studioId || "").trim();
    const memberUserId = String(body?.memberUserId || "").trim();
    if (!studioId || !memberUserId) {
      return Response.json({ error: "studioId and memberUserId required.", code: "VALIDATION" }, { status: 400 });
    }

    const admin = serviceClient();
    const { data: studio } = await admin
      .from("workspace_studios")
      .select("id, owner_id")
      .eq("id", studioId)
      .maybeSingle();
    if (!studio?.id || studio.owner_id !== user.id) {
      return Response.json({ error: "Only the studio owner can remove members.", code: "FORBIDDEN" }, { status: 403 });
    }
    if (memberUserId === user.id) {
      return Response.json({ error: "Owner cannot remove themselves.", code: "VALIDATION" }, { status: 400 });
    }

    const { error } = await admin
      .from("workspace_studio_members")
      .delete()
      .eq("studio_id", studioId)
      .eq("user_id", memberUserId);
    if (error) throw new Error(error.message);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[removeWorkspaceStudioMember]", (error as Error)?.message || error);
    return Response.json({ error: "Could not remove member." }, { status: 500 });
  }
}

serveWithCors(handler);
