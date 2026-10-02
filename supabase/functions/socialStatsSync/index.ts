import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest } from "../_shared/runtime.ts";
import { secrets } from "../_shared/runtime.ts";
import { syncSocialStats } from "../_shared/socialStatsSync.ts";

/**
 * Sync views/likes/comments/shares from connected platforms into AnalyticsEntry.
 * Body: { socialAccountId?: string } — if omitted, syncs all connected accounts for the user.
 */
async function handler (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const encryptionKey = secrets.get("SOCIAL_TOKEN_ENCRYPTION_KEY");
    if (!encryptionKey) {
      return Response.json({ error: "Analytics sync is not configured.", code: "NOT_CONFIGURED" }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const socialAccountId = body?.socialAccountId ? String(body.socialAccountId) : "";

    let accounts = [];
    if (socialAccountId) {
      const one = await base44.asServiceRole.entities.SocialAccount.get(socialAccountId);
      if (!one || one.user_id !== user.id) {
        return Response.json({ error: "Social account not found." }, { status: 404 });
      }
      accounts = [one];
    } else {
      const rows = await base44.asServiceRole.entities.SocialAccount.filter(
        { user_id: user.id, status: "connected" },
        "-connected_at",
        20
      );
      accounts = rows || [];
    }

    const results = [];
    for (const account of accounts) {
      if (!["instagram", "tiktok", "youtube"].includes(String(account.provider))) continue;
      try {
        const r = await syncSocialStats({
          base44,
          socialAccountId: String(account.id),
          encryptionKey,
        });
        results.push(r);
      } catch (err) {
        console.error("[socialStatsSync]", account.provider, (err as Error)?.message || err);
        results.push({
          provider: account.provider,
          socialAccountId: account.id,
          upserted: 0,
          skipped: 0,
          errors: [String((err as Error)?.message || err)],
        });
      }
    }

    return Response.json({ ok: true, results });
  } catch (error) {
    console.error("[socialStatsSync]", error?.message || error);
    return Response.json({ error: "Could not sync social stats." }, { status: 500 });
  }
}


serveWithCors(handler);
