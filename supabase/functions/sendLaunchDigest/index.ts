import { serveWithCors } from "../_shared/cors.ts";
import { secrets, serviceClient } from "../_shared/runtime.ts";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Weekly launch digest email (cron). Requires LAUNCH_DIGEST_CRON_SECRET header.
 * Optional Resend: RESEND_API_KEY + LAUNCH_DIGEST_FROM_EMAIL.
 */
async function handler(req: Request): Promise<Response> {
  try {
    const cronSecret = secrets.get("LAUNCH_DIGEST_CRON_SECRET") || "";
    const header = req.headers.get("x-launch-digest-secret") || "";
    if (!cronSecret || header !== cronSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resendKey = secrets.get("RESEND_API_KEY") || "";
    const fromEmail = secrets.get("LAUNCH_DIGEST_FROM_EMAIL") || "MusicPromo AI <onboarding@resend.dev>";
    if (!resendKey) {
      return Response.json({
        ok: true,
        emailed: 0,
        skipped: true,
        reason: "RESEND_API_KEY not configured",
      });
    }

    const admin = serviceClient();
    const { data: users } = await admin
      .from("users")
      .select("id, email, display_name, launch_digest_enabled, launch_digest_last_sent_at")
      .eq("launch_digest_enabled", true)
      .not("email", "is", null)
      .limit(200);

    const weekMs = 7 * 24 * 60 * 60 * 1000;
    let sent = 0;
    const errors: string[] = [];

    for (const u of users || []) {
      const email = String(u.email || "").trim();
      if (!email) continue;
      const last = u.launch_digest_last_sent_at ? Date.parse(String(u.launch_digest_last_sent_at)) : 0;
      if (last && Date.now() - last < weekMs - 3600000) continue;

      const today = new Date().toISOString().slice(0, 10);
      const { data: dayRows } = await admin
        .from("campaign_days")
        .select("data")
        .eq("user_id", u.id)
        .eq("kind", "day")
        .limit(100);

      let upcoming = 0;
      for (const row of dayRows || []) {
        const data = row.data && typeof row.data === "object" ? row.data : {};
        const date = String(data.date || "");
        if (date >= today) upcoming += 1;
      }

      const subject = `Your launch week — ${upcoming} post${upcoming === 1 ? "" : "s"} ahead`;
      const html = `<p>Hi ${escapeHtml(u.display_name || "there")},</p>
<p>You have <strong>${upcoming}</strong> campaign day(s) coming up in the next week.</p>
<p>Open your <a href="https://musicpromo.ai/">MusicPromo AI</a> dashboard for the full launch board and schedule.</p>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject,
          html,
        }),
      });

      if (!res.ok) {
        errors.push(`${email}: ${res.status}`);
        continue;
      }

      await admin
        .from("users")
        .update({ launch_digest_last_sent_at: new Date().toISOString() })
        .eq("id", u.id);
      sent += 1;
    }

    return Response.json({ ok: true, emailed: sent, errors: errors.slice(0, 10) });
  } catch (error) {
    console.error("[sendLaunchDigest]", (error as Error)?.message || error);
    return Response.json({ error: "Digest send failed." }, { status: 500 });
  }
}

serveWithCors(handler);
