import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";

async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();

    const admin = serviceClient();
    if (token) {
      await admin.from("push_devices").delete().eq("user_id", user.id).eq("token", token);
    } else {
      await admin.from("push_devices").delete().eq("user_id", user.id);
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[unregisterPushToken]", (error as Error)?.message || error);
    return Response.json({ error: "Unregister failed." }, { status: 500 });
  }
}

serveWithCors(handler);
