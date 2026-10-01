import { createClientFromRequest } from "../_shared/runtime.ts";
import { secrets } from "../_shared/runtime.ts";
import { decryptCredential } from "../_shared/socialCrypto.ts";
import { revokeInstagramAccess } from "../_shared/instagramOAuth.ts";

/**
 * Disconnect a social account owned by the authenticated user.
 * Clears encrypted credentials. Instagram revoke is best-effort / often unavailable.
 */
async function handler (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const provider = String(body?.provider || "").toLowerCase();
    const accountId = body?.accountId ? String(body.accountId) : null;

    if (!provider) {
      return Response.json({ error: "Provider is required." }, { status: 400 });
    }

    const rows = await base44.asServiceRole.entities.SocialAccount.filter(
      { user_id: user.id, provider },
      "-connected_at",
      20
    );
    const targets = (rows || []).filter((r) => {
      if (r.status !== "connected") return false;
      if (accountId) return r.id === accountId;
      return true;
    });

    if (!targets.length) {
      return Response.json({ error: "No connected account found." }, { status: 404 });
    }

    let providerRevocation = { attempted: false, revoked: false };

    for (const row of targets) {
      // Ownership enforced by user_id filter above.
      if (row.provider === "instagram" && row.encrypted_credentials) {
        try {
          const key = secrets.get("SOCIAL_TOKEN_ENCRYPTION_KEY");
          if (key) {
            const raw = await decryptCredential(row.encrypted_credentials, key);
            const parsed = JSON.parse(raw);
            if (parsed?.access_token) {
              providerRevocation = await revokeInstagramAccess(parsed.access_token);
            }
          }
        } catch {
          // Still disconnect locally; never leak token material.
          console.error("[socialDisconnect] local credential wipe after decrypt/revoke issue");
        }
      }

      await base44.asServiceRole.entities.SocialAccount.update(row.id, {
        status: "disconnected",
        encrypted_credentials: "",
      });
    }

    return Response.json({
      ok: true,
      provider,
      disconnected: targets.length,
      providerRevocation,
      note: providerRevocation.attempted
        ? undefined
        : "Local credentials removed. Provider-side token revocation was not performed (not available for this Instagram Login flow).",
    });
  } catch (error) {
    console.error("[socialDisconnect]", error?.message || "disconnect failed");
    return Response.json({ error: "Could not disconnect account." }, { status: 500 });
  }
}


Deno.serve(handler);
