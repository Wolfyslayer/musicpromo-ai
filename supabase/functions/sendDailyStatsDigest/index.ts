import { serveWithCors } from "../_shared/cors.ts";
import { secrets, serviceClient } from "../_shared/runtime.ts";
import {
  aggregateDailyStatsForDigest,
  resolveDailyStatsDashboardUrl,
  statsEmailHtml,
  statsEmailSubject,
  statsPushBody,
} from "../_shared/statsDigestAgg.ts";
import { sendFcmNotifications } from "../_shared/fcmPush.ts";
import {
  normalizeNotifyTime,
  normalizeTimeZone,
  shouldSendDailyStatsDigest,
} from "../_shared/timezone.ts";

/**
 * Daily stats digest (cron). Auth: x-daily-stats-secret or x-launch-digest-secret matching LAUNCH_DIGEST_CRON_SECRET.
 * Email: RESEND_API_KEY + LAUNCH_DIGEST_FROM_EMAIL. Push: FCM_SERVICE_ACCOUNT_JSON + push_devices rows.
 * Schedule: run hourly; each user receives at `daily_stats_notify_time` in their stored `timezone`.
 */
async function handler(req: Request): Promise<Response> {
  try {
    const cronSecret = secrets.get("LAUNCH_DIGEST_CRON_SECRET") || secrets.get("DAILY_STATS_CRON_SECRET") || "";
    const header =
      req.headers.get("x-daily-stats-secret") ||
      req.headers.get("x-launch-digest-secret") ||
      "";
    if (!cronSecret || header !== cronSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resendKey = secrets.get("RESEND_API_KEY") || "";
    const fromEmail = secrets.get("LAUNCH_DIGEST_FROM_EMAIL") || "MusicPromo AI <onboarding@resend.dev>";
    const dashboardUrl = resolveDailyStatsDashboardUrl(
      secrets.get("PUBLIC_APP_URL") || secrets.get("APP_PUBLIC_URL") || ""
    );
    const admin = serviceClient();
    const now = new Date();
    const { data: users } = await admin
      .from("users")
      .select(
        "id, email, display_name, timezone, daily_stats_notify_time, daily_stats_email_enabled, daily_stats_push_enabled, daily_stats_last_sent_at"
      )
      .or("daily_stats_email_enabled.eq.true,daily_stats_push_enabled.eq.true")
      .limit(300);

    let emailed = 0;
    let pushed = 0;
    const errors: string[] = [];

    for (const u of users || []) {
      const timeZone = normalizeTimeZone(u.timezone);
      const notifyTime = normalizeNotifyTime(u.daily_stats_notify_time);
      if (
        !shouldSendDailyStatsDigest({
          timeZone,
          notifyTime,
          lastSentAt: u.daily_stats_last_sent_at,
          now,
        })
      ) {
        continue;
      }

      const { data: analyticsRows } = await admin
        .from("analytics_entries")
        .select("id, data")
        .eq("user_id", u.id)
        .limit(500);

      const digest = aggregateDailyStatsForDigest(
        (analyticsRows || []) as Record<string, unknown>[],
        timeZone,
        now
      );
      const displayName = String(u.display_name || "there");
      let didSend = false;

      if (u.daily_stats_email_enabled === true) {
        const email = String(u.email || "").trim();
        if (!email) {
          errors.push(`${u.id}: no_email`);
        } else if (!resendKey) {
          // skip email batch when Resend not configured
        } else {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromEmail,
              to: email,
              subject: statsEmailSubject(digest),
              html: statsEmailHtml({ displayName, digest, dashboardUrl }),
            }),
          });
          if (!res.ok) {
            errors.push(`${email}: ${res.status}`);
          } else {
            emailed += 1;
            didSend = true;
          }
        }
      }

      if (u.daily_stats_push_enabled === true) {
        const { data: devices } = await admin
          .from("push_devices")
          .select("token")
          .eq("user_id", u.id)
          .limit(20);
        const tokens = (devices || []).map((d: { token: string }) => String(d.token || "")).filter(Boolean);
        const pushResult = await sendFcmNotifications({
          tokens,
          title: "Your daily stats",
          body: statsPushBody(digest),
          data: { route: "/analytics", date: digest.date },
        });
        if (!pushResult.skipped && pushResult.sent > 0) {
          pushed += pushResult.sent;
          didSend = true;
        } else if (!pushResult.skipped && pushResult.failed > 0) {
          errors.push(`${u.id}: push_failed_${pushResult.failed}`);
        }
      }

      if (didSend) {
        await admin
          .from("users")
          .update({ daily_stats_last_sent_at: new Date().toISOString() })
          .eq("id", u.id);
      }
    }

    return Response.json({
      ok: true,
      emailed,
      pushMessages: pushed,
      resendConfigured: Boolean(resendKey),
      errors: errors.slice(0, 15),
    });
  } catch (error) {
    console.error("[sendDailyStatsDigest]", (error as Error)?.message || error);
    return Response.json({ error: "Daily stats digest failed." }, { status: 500 });
  }
}

serveWithCors(handler);
