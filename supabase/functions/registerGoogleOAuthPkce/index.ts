import { jsonWithCors, servePostApi } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/runtime.ts";

const TTL_MS = 15 * 60 * 1000;

async function handler(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const state = String(body?.state || "").trim();
    const codeVerifier = String(body?.codeVerifier || "").trim();
    const returnTo = String(body?.returnTo || "/").trim() || "/";

    if (state.length < 16 || codeVerifier.length < 32) {
      return jsonWithCors(req, { error: "Invalid OAuth state." }, 400);
    }

    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
    const admin = serviceClient();

    await admin.from("google_oauth_pkce").delete().lt("expires_at", new Date().toISOString());

    const { error } = await admin.from("google_oauth_pkce").upsert(
      {
        state,
        code_verifier: codeVerifier,
        return_to: returnTo.startsWith("/") ? returnTo : "/",
        expires_at: expiresAt,
      },
      { onConflict: "state" }
    );

    if (error) {
      console.error("[registerGoogleOAuthPkce]", error.message);
      return jsonWithCors(req, { error: "Could not start sign-in session." }, 500);
    }

    return jsonWithCors(req, { ok: true });
  } catch (error) {
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);
