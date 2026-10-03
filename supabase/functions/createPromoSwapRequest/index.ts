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
    const targetUserId = String(body?.targetUserId || "").trim();
    const message = String(body?.message || "").trim().slice(0, 500);
    const campaignId = body?.campaignId ? String(body.campaignId) : null;

    if (!targetUserId) {
      return Response.json({ error: "targetUserId is required.", code: "VALIDATION" }, { status: 400 });
    }
    if (targetUserId === user.id) {
      return Response.json({ error: "You cannot request a swap with yourself.", code: "VALIDATION" }, { status: 400 });
    }
    if (message.length < 10) {
      return Response.json({ error: "Message must be at least 10 characters.", code: "VALIDATION" }, { status: 400 });
    }

    const admin = serviceClient();
    const { data: target } = await admin
      .from("users")
      .select("id, profile_public, allow_public_contact, community_collab_intents")
      .eq("id", targetUserId)
      .maybeSingle();
    if (!target?.id || target.profile_public !== true) {
      return Response.json({ error: "Profile not found.", code: "NOT_FOUND" }, { status: 404 });
    }

    const intents = Array.isArray(target.community_collab_intents) ? target.community_collab_intents : [];
    const open =
      target.allow_public_contact === true ||
      intents.includes("promo_swap") ||
      intents.includes("feature");
    if (!open) {
      return Response.json(
        { error: "This artist is not open to promo swap requests.", code: "NOT_OPEN" },
        { status: 403 }
      );
    }

    const { data: pending } = await admin
      .from("community_promo_requests")
      .select("id")
      .eq("requester_id", user.id)
      .eq("target_user_id", targetUserId)
      .eq("status", "pending")
      .maybeSingle();
    if (pending?.id) {
      return Response.json({ error: "You already have a pending request.", code: "DUPLICATE" }, { status: 409 });
    }

    const { data: row, error: insErr } = await admin
      .from("community_promo_requests")
      .insert({
        requester_id: user.id,
        target_user_id: targetUserId,
        message,
        campaign_id: campaignId,
        status: "pending",
      })
      .select("id, status, created_at")
      .maybeSingle();
    if (insErr) throw new Error(insErr.message);

    return Response.json({ ok: true, request: row });
  } catch (error) {
    console.error("[createPromoSwapRequest]", (error as Error)?.message || error);
    return Response.json({ error: "Could not send request." }, { status: 500 });
  }
}

serveWithCors(handler);
