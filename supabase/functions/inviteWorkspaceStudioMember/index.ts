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
    const email = String(body?.email || "").trim().toLowerCase();
    if (!studioId || !email.includes("@")) {
      return Response.json({ error: "studioId and email required.", code: "VALIDATION" }, { status: 400 });
    }

    const admin = serviceClient();
    const { data: studio } = await admin
      .from("workspace_studios")
      .select("id, owner_id")
      .eq("id", studioId)
      .maybeSingle();
    if (!studio?.id || studio.owner_id !== user.id) {
      return Response.json({ error: "Only the studio owner can invite.", code: "FORBIDDEN" }, { status: 403 });
    }

    const { data: invitee } = await admin.from("users").select("id, email").eq("email", email).maybeSingle();
    if (!invitee?.id) {
      return Response.json(
        {
          error: "No account with that email yet. They must sign up first.",
          code: "NOT_FOUND",
        },
        { status: 404 }
      );
    }
    if (invitee.id === user.id) {
      return Response.json({ error: "You are already the owner.", code: "VALIDATION" }, { status: 400 });
    }

    const { count } = await admin
      .from("workspace_studio_members")
      .select("user_id", { count: "exact", head: true })
      .eq("studio_id", studioId);
    if ((count || 0) >= 10) {
      return Response.json({ error: "Studio member limit reached (10).", code: "LIMIT" }, { status: 400 });
    }

    const { error: insErr } = await admin.from("workspace_studio_members").upsert(
      {
        studio_id: studioId,
        user_id: invitee.id,
        role: "manager",
      },
      { onConflict: "studio_id,user_id" }
    );
    if (insErr) throw new Error(insErr.message);

    return Response.json({ ok: true, invitedUserId: invitee.id });
  } catch (error) {
    console.error("[inviteWorkspaceStudioMember]", (error as Error)?.message || error);
    return Response.json({ error: "Could not invite member." }, { status: 500 });
  }
}

serveWithCors(handler);
