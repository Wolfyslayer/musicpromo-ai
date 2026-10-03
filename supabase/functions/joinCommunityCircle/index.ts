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
    const inviteCode = String(body?.inviteCode || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (inviteCode.length < 6) {
      return Response.json({ error: "Enter a valid invite code.", code: "VALIDATION" }, { status: 400 });
    }

    const admin = serviceClient();
    const { data: circle } = await admin
      .from("community_circles")
      .select("id, name, invite_code, max_members")
      .eq("invite_code", inviteCode)
      .maybeSingle();
    if (!circle?.id) {
      return Response.json({ error: "Circle not found.", code: "NOT_FOUND" }, { status: 404 });
    }

    const { data: existing } = await admin
      .from("community_circle_members")
      .select("user_id")
      .eq("circle_id", circle.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing?.user_id) {
      return Response.json({ ok: true, alreadyMember: true, circleId: circle.id, name: circle.name });
    }

    const { count } = await admin
      .from("community_circle_members")
      .select("user_id", { count: "exact", head: true })
      .eq("circle_id", circle.id);
    if ((count || 0) >= circle.max_members) {
      return Response.json({ error: "This circle is full.", code: "FULL" }, { status: 409 });
    }

    const { error: insErr } = await admin.from("community_circle_members").insert({
      circle_id: circle.id,
      user_id: user.id,
      role: "member",
    });
    if (insErr) throw new Error(insErr.message);

    return Response.json({ ok: true, circleId: circle.id, name: circle.name });
  } catch (error) {
    console.error("[joinCommunityCircle]", (error as Error)?.message || error);
    return Response.json({ error: "Could not join circle." }, { status: 500 });
  }
}

serveWithCors(handler);
