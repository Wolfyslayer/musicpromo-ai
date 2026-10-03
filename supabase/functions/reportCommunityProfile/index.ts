import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";

const REASONS = new Set(["spam", "impersonation", "harassment", "inappropriate", "other"]);

async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const reportedUserId = String(body?.reportedUserId || "").trim();
    const reason = String(body?.reason || "other").trim().toLowerCase();
    const details = String(body?.details || "").slice(0, 500);

    if (!reportedUserId) {
      return Response.json({ error: "reportedUserId is required.", code: "VALIDATION" }, { status: 400 });
    }
    if (reportedUserId === user.id) {
      return Response.json({ error: "You cannot report yourself.", code: "VALIDATION" }, { status: 400 });
    }
    if (!REASONS.has(reason)) {
      return Response.json({ error: "Invalid reason.", code: "VALIDATION" }, { status: 400 });
    }

    const admin = serviceClient();
    const { data: target } = await admin
      .from("users")
      .select("id, profile_public")
      .eq("id", reportedUserId)
      .maybeSingle();
    if (!target?.id || target.profile_public !== true) {
      return Response.json({ error: "Profile not found.", code: "NOT_FOUND" }, { status: 404 });
    }

    const { error: insErr } = await admin.from("community_reports").insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId,
      reason,
      details: details || null,
    });
    if (insErr) throw new Error(insErr.message);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[reportCommunityProfile]", (error as Error)?.message || error);
    return Response.json({ error: "Could not submit report." }, { status: 500 });
  }
}

serveWithCors(handler);
