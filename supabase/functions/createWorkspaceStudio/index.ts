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
    const name = String(body?.name || "").trim().slice(0, 64);
    if (name.length < 2) {
      return Response.json({ error: "Studio name is required.", code: "VALIDATION" }, { status: 400 });
    }

    const admin = serviceClient();
    const { count } = await admin
      .from("workspace_studios")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);
    if ((count || 0) >= 3) {
      return Response.json({ error: "You can own up to 3 studios.", code: "LIMIT" }, { status: 400 });
    }

    const { data: studio, error } = await admin
      .from("workspace_studios")
      .insert({ owner_id: user.id, name })
      .select("id, name, owner_id, created_at")
      .maybeSingle();
    if (error || !studio?.id) throw new Error(error?.message || "Insert failed");

    await admin.from("workspace_studio_members").insert({
      studio_id: studio.id,
      user_id: user.id,
      role: "owner",
    });

    return Response.json({ ok: true, studio });
  } catch (error) {
    console.error("[createWorkspaceStudio]", (error as Error)?.message || error);
    return Response.json({ error: "Could not create studio." }, { status: 500 });
  }
}

serveWithCors(handler);
