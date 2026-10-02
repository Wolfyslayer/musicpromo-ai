import { secrets } from "../_shared/runtime.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function clientId(): string {
  return (
    secrets.get("GOOGLE_CLIENT_ID") ||
    secrets.get("YOUTUBE_CLIENT_ID") ||
    Deno.env.get("GOOGLE_CLIENT_ID") ||
    ""
  ).trim();
}

/** Secret for the Web client used at login (may differ from YOUTUBE_* social-connect client). */
function clientSecret(): string {
  return (
    secrets.get("GOOGLE_LOGIN_CLIENT_SECRET") ||
    secrets.get("GOOGLE_CLIENT_SECRET") ||
    secrets.get("YOUTUBE_CLIENT_SECRET") ||
    Deno.env.get("GOOGLE_CLIENT_SECRET") ||
    ""
  ).trim();
}

async function handler(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const code = body?.code ? String(body.code) : "";
    const codeVerifier = body?.codeVerifier ? String(body.codeVerifier) : "";
    const redirectUri = body?.redirectUri ? String(body.redirectUri) : "";
    const clientIdFromApp = body?.clientId ? String(body.clientId).trim() : "";

    if (!code || !codeVerifier || !redirectUri) {
      return jsonWithCors(req, { error: "code, codeVerifier, and redirectUri are required." }, 400);
    }

    // Login uses VITE_GOOGLE_CLIENT_ID from the app; social YouTube may use a different OAuth client in secrets.
    const id = clientIdFromApp || clientId();
    const secret = clientSecret();
    if (!id || !secret) {
      return jsonWithCors(
        req,
        {
          error:
            "Set GOOGLE_CLIENT_SECRET (or GOOGLE_LOGIN_CLIENT_SECRET) in Supabase for your login Web client, and VITE_GOOGLE_CLIENT_ID in the app build.",
        },
        500
      );
    }

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: id,
        client_secret: secret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
    });

    const tokens = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) {
      const msg =
        (tokens && (tokens.error_description || tokens.error)) ||
        `Google token exchange failed (${tokenRes.status})`;
      let hint = String(msg);
      if (/client was not found|invalid_client/i.test(hint)) {
        hint +=
          " Check GOOGLE_CLIENT_SECRET is the secret for the same Web client as VITE_GOOGLE_CLIENT_ID / GOOGLE_CLIENT_ID.";
      }
      if (/redirect_uri_mismatch/i.test(hint)) {
        hint += " Register exactly: " + redirectUri + " in Google Cloud redirect URIs.";
      }
      return jsonWithCors(req, { error: hint }, 400);
    }

    const idToken = tokens.id_token ? String(tokens.id_token) : "";
    if (!idToken) {
      return jsonWithCors(req, { error: "Google did not return an id_token." }, 400);
    }

    return jsonWithCors(req, { id_token: idToken });
  } catch (error) {
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);
