import { jsonWithCors, servePostApi } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/runtime.ts";

const HANDLE_RE = /^[a-z0-9_]{3,24}$/;

const RESERVED = new Set([
  "admin",
  "support",
  "help",
  "api",
  "login",
  "register",
  "signup",
  "sign_up",
  "profile",
  "community",
  "settings",
  "dashboard",
  "create",
  "social",
  "campaigns",
  "releases",
  "analytics",
  "musicpromo",
  "musicpromoai",
  "null",
  "undefined",
  "me",
  "you",
  "root",
  "system",
]);

function normalizeHandle(raw: string): string {
  let h = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
  h = h.replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return h.slice(0, 24);
}

/** Public: check whether a profile @handle is free (case-insensitive unique in DB). */
async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      return jsonWithCors(req, { error: "Method not allowed" }, 405);
    }
    const body = await req.json().catch(() => ({}));
    const handle = normalizeHandle(String(body?.handle || ""));

    if (!handle) {
      return jsonWithCors(req, { available: false, handle, error: "Enter a username." }, 200);
    }
    if (!HANDLE_RE.test(handle)) {
      return jsonWithCors(
        req,
        {
          available: false,
          handle,
          error: "Handle must be 3–24 characters: lowercase letters, numbers, and underscores.",
        },
        200
      );
    }
    if (RESERVED.has(handle)) {
      return jsonWithCors(req, { available: false, handle, error: "That handle is reserved." }, 200);
    }

    const admin = serviceClient();
    const { data, error } = await admin.from("users").select("id").eq("handle", handle).maybeSingle();
    if (error) {
      return jsonWithCors(req, { available: false, handle, error: error.message }, 500);
    }

    return jsonWithCors(req, { available: !data, handle }, 200);
  } catch (e) {
    return jsonWithCors(req, { error: (e as Error).message }, 500);
  }
}

servePostApi(handler);
