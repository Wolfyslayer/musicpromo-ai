import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";

/**
 * Permanently delete the signed-in account and workspace data.
 * Body: { confirm: "DELETE" }
 */
async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    if (String(body?.confirm || "") !== "DELETE") {
      return Response.json(
        { error: 'Type DELETE in confirm to permanently delete your account.', code: "VALIDATION" },
        { status: 400 }
      );
    }

    const uid = String(user.id);
    const admin = serviceClient();

    await admin.from("social_accounts").delete().eq("user_id", uid);
    await admin.from("campaign_days").delete().eq("user_id", uid);
    await admin.from("prepared_media").delete().eq("user_id", uid);
    await admin.from("analytics_entries").delete().eq("user_id", uid);
    await admin.from("users").delete().eq("id", uid);

    const { error: authErr } = await admin.auth.admin.deleteUser(uid);
    if (authErr) {
      console.error("[deleteAccount] auth.admin.deleteUser", authErr.message);
      return Response.json(
        { error: "Could not remove auth user. Contact support if data was partially deleted." },
        { status: 500 }
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[deleteAccount]", (error as Error)?.message || error);
    return Response.json({ error: "Account deletion failed." }, { status: 500 });
  }
}

serveWithCors(handler);
