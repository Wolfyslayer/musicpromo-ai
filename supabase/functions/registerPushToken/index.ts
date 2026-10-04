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
    const platform = String(body?.platform || "").trim().toLowerCase();

    if (!token || token.length < 20) {
      return Response.json({ error: "Invalid device token.", code: "VALIDATION" }, { status: 400 });
    }
    if (platform !== "ios" && platform !== "android") {
      return Response.json({ error: "platform must be ios or android.", code: "VALIDATION" }, { status: 400 });
    }

    const admin = serviceClient();
    const { error } = await admin.from("push_devices").upsert(
      {
        user_id: user.id,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );

    if (error) {
      console.error("[registerPushToken]", error.message);
      return Response.json({ error: "Could not save device token." }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[registerPushToken]", (error as Error)?.message || error);
    return Response.json({ error: "Registration failed." }, { status: 500 });
  }
}

serveWithCors(handler);
