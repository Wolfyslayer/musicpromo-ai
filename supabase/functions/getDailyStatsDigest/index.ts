import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { aggregateDailyStats, yesterdayForUserTimeZone } from "../_shared/statsDigestAgg.ts";
import { normalizeNotifyTime, normalizeTimeZone, timeZoneShortLabel } from "../_shared/timezone.ts";

async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = serviceClient();
    const profileRes = await admin
      .from("users")
      .select(
        "daily_stats_email_enabled, daily_stats_push_enabled, daily_stats_last_sent_at, daily_stats_notify_time, timezone, email, display_name"
      )
      .eq("id", user.id)
      .maybeSingle();

    let profile = profileRes.data;
    let schemaReady = true;
    if (profileRes.error) {
      const msg = profileRes.error.message || "";
      if (/daily_stats_|column users\.(daily_stats|timezone)/i.test(msg)) {
        schemaReady = false;
        const fallback = await admin
          .from("users")
          .select("email, display_name")
          .eq("id", user.id)
          .maybeSingle();
        profile = fallback.data;
      } else {
        throw profileRes.error;
      }
    }

    const timeZone = normalizeTimeZone(profile?.timezone);
    const targetDate = yesterdayForUserTimeZone(timeZone);

    const { data: analyticsRows } = await admin
      .from("analytics_entries")
      .select("id, data")
      .eq("user_id", user.id)
      .limit(500);

    const digest = aggregateDailyStats(
      (analyticsRows || []) as Record<string, unknown>[],
      targetDate,
      timeZone
    );

    return Response.json({
      ok: true,
      digest: {
        ...digest,
        timeZone,
        timeZoneLabel: timeZoneShortLabel(timeZone),
        notifyTime: normalizeNotifyTime(profile?.daily_stats_notify_time),
        emailEnabled: profile?.daily_stats_email_enabled === true,
        pushEnabled: profile?.daily_stats_push_enabled === true,
        lastSentAt: profile?.daily_stats_last_sent_at || null,
        schemaReady,
        schemaHint: schemaReady
          ? null
          : "Run supabase/migrations/20261005_daily_stats_full.sql in Supabase SQL editor.",
      },
    });
  } catch (error) {
    console.error("[getDailyStatsDigest]", (error as Error)?.message || error);
    return Response.json({ error: "Could not build daily stats preview." }, { status: 500 });
  }
}

serveWithCors(handler);
