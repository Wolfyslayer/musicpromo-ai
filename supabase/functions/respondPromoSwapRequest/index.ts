import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";

const ACTIONS = new Set(["accept", "decline", "cancel"]);

async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.requestId || "").trim();
    const action = String(body?.action || "").trim().toLowerCase();

    if (!requestId || !ACTIONS.has(action)) {
      return Response.json({ error: "requestId and action required.", code: "VALIDATION" }, { status: 400 });
    }

    const admin = serviceClient();
    const { data: row } = await admin
      .from("community_promo_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (!row?.id) {
      return Response.json({ error: "Request not found.", code: "NOT_FOUND" }, { status: 404 });
    }
    if (row.status !== "pending") {
      return Response.json({ error: "Request already handled.", code: "CONFLICT" }, { status: 409 });
    }

    if (action === "cancel") {
      if (row.requester_id !== user.id) {
        return Response.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
      }
      await admin
        .from("community_promo_requests")
        .update({ status: "cancelled", responded_at: new Date().toISOString() })
        .eq("id", requestId);
      return Response.json({ ok: true, status: "cancelled" });
    }

    if (row.target_user_id !== user.id) {
      return Response.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }

    const status = action === "accept" ? "accepted" : "declined";
    await admin
      .from("community_promo_requests")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", requestId);

    return Response.json({ ok: true, status });
  } catch (error) {
    console.error("[respondPromoSwapRequest]", (error as Error)?.message || error);
    return Response.json({ error: "Could not update request." }, { status: 500 });
  }
}

serveWithCors(handler);
