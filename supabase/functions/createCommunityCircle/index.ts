import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i += 1) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim().slice(0, 48);
    if (name.length < 2) {
      return Response.json({ error: "Circle name is required.", code: "VALIDATION" }, { status: 400 });
    }

    const admin = serviceClient();
    const { count } = await admin
      .from("community_circles")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);
    if ((count || 0) >= 5) {
      return Response.json({ error: "You can own up to 5 circles.", code: "LIMIT" }, { status: 400 });
    }

    let inviteCode = randomCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: circle, error } = await admin
        .from("community_circles")
        .insert({
          owner_id: user.id,
          name,
          invite_code: inviteCode,
        })
        .select("id, name, invite_code, max_members, created_at")
        .maybeSingle();
      if (!error && circle?.id) {
        await admin.from("community_circle_members").insert({
          circle_id: circle.id,
          user_id: user.id,
          role: "owner",
        });
        return Response.json({ ok: true, circle });
      }
      if (error?.code === "23505") {
        inviteCode = randomCode();
        continue;
      }
      if (error) throw new Error(error.message);
    }

    return Response.json({ error: "Could not create circle." }, { status: 500 });
  } catch (error) {
    console.error("[createCommunityCircle]", (error as Error)?.message || error);
    return Response.json({ error: "Could not create circle." }, { status: 500 });
  }
}

serveWithCors(handler);
