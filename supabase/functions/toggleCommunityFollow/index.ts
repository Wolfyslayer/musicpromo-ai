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
    const followedUserId = String(body?.followedUserId || body?.userId || "").trim();
    if (!followedUserId) {
      return Response.json({ error: "followedUserId is required.", code: "VALIDATION" }, { status: 400 });
    }
    if (followedUserId === user.id) {
      return Response.json({ error: "You cannot follow yourself.", code: "VALIDATION" }, { status: 400 });
    }

    const admin = serviceClient();
    const { data: target, error: targetErr } = await admin
      .from("users")
      .select("id, profile_public")
      .eq("id", followedUserId)
      .maybeSingle();
    if (targetErr) throw new Error(targetErr.message);
    if (!target?.id || target.profile_public !== true) {
      return Response.json({ error: "That profile is not public.", code: "NOT_FOUND" }, { status: 404 });
    }

    const { data: existing, error: findErr } = await admin
      .from("community_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("followed_user_id", followedUserId)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);

    if (existing?.id) {
      const { error: delErr } = await admin.from("community_follows").delete().eq("id", existing.id);
      if (delErr) throw new Error(delErr.message);
      return Response.json({ ok: true, following: false, followedUserId });
    }

    const { error: insErr } = await admin.from("community_follows").insert({
      follower_id: user.id,
      followed_user_id: followedUserId,
    });
    if (insErr) throw new Error(insErr.message);

    return Response.json({ ok: true, following: true, followedUserId });
  } catch (error) {
    console.error("[toggleCommunityFollow]", (error as Error)?.message || error);
    return Response.json({ error: "Could not update follow." }, { status: 500 });
  }
}

serveWithCors(handler);
