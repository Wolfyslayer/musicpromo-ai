import { createClientFromRequest } from "../_shared/runtime.ts";
import { secrets } from "../_shared/runtime.ts";
import {
  buildDayCaption,
  publishSocialPostCore,
  resolveDayPublishProviders,
  resolveScheduledAt,
  safeSocialPost,
} from "../_shared/socialPublishCore.ts";
import { processQueuedVideoRenders } from "../_shared/videoRender.ts";
import { syncSocialStats } from "../_shared/socialStatsSync.ts";
import { pickSocialAccountForArtist } from "../_shared/socialAccountScope.ts";
import { kickCampaignWorkerAsync } from "../_shared/kickCampaignWorker.ts";

const DEFAULT_BATCH = 20;
const MAX_BATCH = 40;
const CONCURRENCY = 3;
const STALE_PUBLISHING_MS = 45 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const STATS_CHECKPOINT_KEY = "daily_social_stats_sync";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
      await sleep(250);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) || 1 }, () => run());
  await Promise.all(runners);
  return results;
}

function isDue(iso: string | null | undefined, nowMs: number): boolean {
  if (!iso) return false;
  const t = Date.parse(String(iso));
  return !Number.isNaN(t) && t <= nowMs;
}

async function shouldRunDailyStats(
  // deno-lint-ignore no-explicit-any
  base44: any,
  force: boolean
): Promise<boolean> {
  if (force) return true;
  try {
    const rows =
      (await base44.asServiceRole.entities.AutomationCheckpoint.filter(
        { key: STATS_CHECKPOINT_KEY },
        "-last_run_at",
        1
      )) || [];
    const last = rows[0]?.last_run_at ? Date.parse(String(rows[0].last_run_at)) : 0;
    if (!last || Number.isNaN(last)) return true;
    return Date.now() - last >= DAY_MS;
  } catch {
    // Entity may not exist yet — still attempt sync once.
    return true;
  }
}

async function markDailyStatsDone(
  // deno-lint-ignore no-explicit-any
  base44: any,
  meta: Record<string, unknown>
) {
  try {
    const rows =
      (await base44.asServiceRole.entities.AutomationCheckpoint.filter(
        { key: STATS_CHECKPOINT_KEY },
        "-last_run_at",
        1
      )) || [];
    const payload = {
      key: STATS_CHECKPOINT_KEY,
      last_run_at: new Date().toISOString(),
      meta: JSON.stringify(meta),
    };
    if (rows[0]?.id) {
      await base44.asServiceRole.entities.AutomationCheckpoint.update(rows[0].id, payload);
    } else {
      await base44.asServiceRole.entities.AutomationCheckpoint.create(payload);
    }
  } catch (err) {
    console.warn("[campaignWorker] checkpoint", (err as Error)?.message || err);
  }
}

/**
 * Sync analytics for every connected SocialAccount (isolated errors per account).
 */
async function runDailyStatsSync(params: {
  // deno-lint-ignore no-explicit-any
  base44: any;
  encryptionKey: string;
}): Promise<Record<string, unknown>> {
  const accounts =
    (await params.base44.asServiceRole.entities.SocialAccount.filter(
      { status: "connected" },
      "-connected_at",
      100
    ).catch(() => [])) || [];

  const results = [];
  for (const account of accounts) {
    if (!["instagram", "tiktok", "youtube"].includes(String(account.provider))) continue;
    try {
      const r = await syncSocialStats({
        base44: params.base44,
        socialAccountId: String(account.id),
        encryptionKey: params.encryptionKey,
      });
      results.push(r);
    } catch (err) {
      console.error(
        "[campaignWorker] stats",
        account.provider,
        (err as Error)?.message || err
      );
      results.push({
        provider: account.provider,
        socialAccountId: account.id,
        upserted: 0,
        skipped: 0,
        errors: [String((err as Error)?.message || err)],
      });
    }
    await sleep(200);
  }

  const summary = {
    accounts: results.length,
    upserted: results.reduce((n, r) => n + (Number(r.upserted) || 0), 0),
    errors: results.reduce((n, r) => n + ((r.errors && r.errors.length) || 0), 0),
    results,
  };
  await markDailyStatsDone(params.base44, {
    accounts: summary.accounts,
    upserted: summary.upserted,
    errors: summary.errors,
  });
  return summary;
}

/**
 * Background worker:
 * 1) Auto-publish due SocialPosts
 * 2) Drain stale client-render video queue locks
 * 3) Daily social analytics sync (once / 24h, or forceStats)
 *
 * Errors in video/stats paths never abort publish processing.
 */
export async function handleCampaignWorkerRequest(req: Request): Promise<Response> {
  const startedAt = Date.now();
  const base44 = createClientFromRequest(req);

  try {
    const body = await req.json().catch(() => ({}));
    const args = body?.args && typeof body.args === "object" ? body.args : body || {};
    const batchLimit = Math.min(
      MAX_BATCH,
      Math.max(1, Number(args.batchLimit) || DEFAULT_BATCH)
    );
    const forceStats = args.forceStats === true || args.runStats === true;
    const skipStats = args.skipStats === true;
    const skipPublish = args.skipPublish === true;
    const skipVideo = args.skipVideo === true;

    const encryptionKey = secrets.get("SOCIAL_TOKEN_ENCRYPTION_KEY") || "";
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // --- Video queue (isolated) ---
    let videoSummary: Record<string, unknown> = { attempted: 0, completed: 0, failed: 0 };
    if (!skipVideo) {
      try {
        videoSummary = await processQueuedVideoRenders({
          base44,
          limit: Math.min(4, batchLimit),
        });
      } catch (err) {
        console.error("[campaignWorker] video queue", (err as Error)?.message || err);
        videoSummary = {
          attempted: 0,
          completed: 0,
          failed: 0,
          error: String((err as Error)?.message || err),
        };
      }
    }

    // --- Daily stats (isolated) ---
    let statsSummary: Record<string, unknown> | null = null;
    if (!skipStats && encryptionKey && (await shouldRunDailyStats(base44, forceStats))) {
      try {
        statsSummary = await runDailyStatsSync({ base44, encryptionKey });
      } catch (err) {
        console.error("[campaignWorker] daily stats", (err as Error)?.message || err);
        statsSummary = { error: String((err as Error)?.message || err) };
      }
    }

    if (skipPublish) {
      return Response.json({
        ok: true,
        ranAt: nowIso,
        durationMs: Date.now() - startedAt,
        video: videoSummary,
        stats: statsSummary,
        publish: { skipped: true },
      });
    }

    if (!encryptionKey) {
      const dueDays =
        (await base44.asServiceRole.entities.CampaignDay.filter({ status: "scheduled" }, "scheduled_at", 80)) ||
        [];
      for (const day of dueDays) {
        if (!isDue(day.scheduled_at || resolveScheduledAt(day), nowMs)) continue;
        await base44.asServiceRole.entities.CampaignDay.update(day.id, {
          publish_error:
            "Auto-publish is not configured on the server (SOCIAL_TOKEN_ENCRYPTION_KEY). Add the secret and retry.",
        });
      }
      return Response.json({
        ok: false,
        ranAt: nowIso,
        durationMs: Date.now() - startedAt,
        video: videoSummary,
        stats: statsSummary,
        publish: {
          skipped: true,
          reason: "SOCIAL_TOKEN_ENCRYPTION_KEY missing",
        },
      });
    }

    // --- Publish pipeline (existing) ---
    const scheduledDays =
      (await base44.asServiceRole.entities.CampaignDay.filter(
        { status: "scheduled" },
        "scheduled_at",
        120
      )) || [];

    const dayMaterialized: Array<Record<string, unknown>> = [];
    for (const day of scheduledDays) {
      if (!isDue(day.scheduled_at || resolveScheduledAt(day), nowMs)) continue;
      if (dayMaterialized.length >= batchLimit) break;

      const userId = String(day.user_id || "");
      if (!userId) {
        await base44.asServiceRole.entities.CampaignDay.update(day.id, {
          status: "failed",
          publish_error: "Missing owner user_id — re-schedule this day from the campaign planner.",
        });
        continue;
      }

      const providers = resolveDayPublishProviders(day as Record<string, unknown>);
      if (!providers.length) {
        await base44.asServiceRole.entities.CampaignDay.update(day.id, {
          status: "failed",
          publish_error: `Platform "${day.platform}" is not supported for auto-publish.`,
        });
        continue;
      }

      let campaign: Record<string, unknown> | null = null;
      try {
        campaign = await base44.asServiceRole.entities.Campaign.get(day.campaign_id);
      } catch {
        campaign = null;
      }

      const existing =
        (await base44.asServiceRole.entities.SocialPost.filter(
          { campaign_day_id: day.id, user_id: userId },
          "-created_date",
          20
        )) || [];

      const caption = buildDayCaption(day);
      let videoProjectId = day.video_project_id ? String(day.video_project_id) : "";
      let mediaUrl = "";
      let mediaType = "IMAGE";

      if (videoProjectId) {
        try {
          const vp = await base44.asServiceRole.entities.VideoProject.get(videoProjectId);
          if (vp?.rendering_status === "complete" && vp?.render_output_url) {
            mediaUrl = String(vp.render_output_url);
            mediaType = "REELS";
          }
        } catch {
          /* optional */
        }
      }

      if (!mediaUrl && campaign?.release_id) {
        try {
          const release = await base44.asServiceRole.entities.Release.get(campaign.release_id);
          if (release?.artwork_url) mediaUrl = String(release.artwork_url);
        } catch {
          /* optional */
        }
      }

      const scheduledAt = resolveScheduledAt(day, day.scheduled_at);
      let createdAny = false;

      for (const provider of providers) {
        const already = existing.find(
          (p: Record<string, unknown>) =>
            String(p.provider) === provider &&
            ["scheduled", "publishing", "published"].includes(String(p.status))
        );
        if (already) continue;

        const accounts =
          (await base44.asServiceRole.entities.SocialAccount.filter(
            { user_id: userId, provider, status: "connected" },
            "-connected_at",
            20
          )) || [];
        const campaignArtistId = campaign?.artist_id ? String(campaign.artist_id) : "";
        if (!campaignArtistId) {
          await base44.asServiceRole.entities.CampaignDay.update(day.id, {
            status: "failed",
            publish_error: "Campaign has no artist — cannot auto-publish to social.",
          });
          continue;
        }
        const account = pickSocialAccountForArtist(accounts, provider, campaignArtistId);
        if (!account) {
          await base44.asServiceRole.entities.CampaignDay.update(day.id, {
            status: "failed",
            publish_error: `Connect ${provider} for this artist in Social Hub, then reschedule.`,
          });
          continue;
        }

        if ((provider === "tiktok" || provider === "youtube") && mediaType !== "REELS") {
          continue;
        }

        await base44.asServiceRole.entities.SocialPost.create({
          user_id: userId,
          campaign_id: String(day.campaign_id || ""),
          campaign_day_id: String(day.id),
          release_id: campaign?.release_id ? String(campaign.release_id) : "",
          social_account_id: account.id,
          provider,
          platform: provider,
          content_type: String(day.content_type || day.platform || ""),
          caption,
          media_url: mediaUrl,
          media_type: mediaType,
          video_project_id: videoProjectId,
          status: "scheduled",
          scheduled_at: scheduledAt,
          error_code: "",
          error_message: "",
        });
        createdAny = true;
      }

      const hasDuePosts = existing.some(
        (p: Record<string, unknown>) =>
          String(p.status) === "scheduled" && isDue(p.scheduled_at as string, nowMs)
      );

      if (createdAny || hasDuePosts) {
        await base44.asServiceRole.entities.CampaignDay.update(day.id, {
          status: "processing",
          publish_error: "",
        });
        if (createdAny) dayMaterialized.push({ dayId: day.id, providers });
      } else if (!existing.length) {
        await base44.asServiceRole.entities.CampaignDay.update(day.id, {
          status: "failed",
          publish_error:
            "No connected SocialAccounts (or video missing for TikTok/YouTube). Connect accounts and retry schedule.",
        });
      }
    }

    const scheduledPosts =
      (await base44.asServiceRole.entities.SocialPost.filter(
        { status: "scheduled" },
        "scheduled_at",
        150
      )) || [];

    const dueAll = scheduledPosts.filter((p: Record<string, unknown>) =>
      isDue(p.scheduled_at as string, nowMs)
    );
    const due = dueAll.slice(0, batchLimit);
    const publishBacklog = dueAll.length > batchLimit;

    const publishing =
      (await base44.asServiceRole.entities.SocialPost.filter(
        { status: "publishing" },
        "-updated_date",
        30
      )) || [];
    for (const p of publishing) {
      const updated = Date.parse(String(p.updated_date || p.created_date || ""));
      if (!Number.isNaN(updated) && nowMs - updated > STALE_PUBLISHING_MS) {
        await base44.asServiceRole.entities.SocialPost.update(p.id, {
          status: "scheduled",
          scheduled_at: p.scheduled_at || nowIso,
          error_code: "STALE_LOCK",
          error_message: "Re-queued after stale publishing lock.",
        });
        if (due.length < batchLimit) due.push({ ...p, status: "scheduled" });
      }
    }

    const publishResults = await mapPool(due, CONCURRENCY, async (post) => {
      try {
        const fresh = await base44.asServiceRole.entities.SocialPost.get(post.id);
        if (!fresh || fresh.status !== "scheduled") {
          return { postId: post.id, skipped: true, reason: "not_scheduled" };
        }
        const result = await publishSocialPostCore({
          base44,
          postId: String(post.id),
          encryptionKey,
          allowScheduled: true,
        });
        return {
          postId: post.id,
          provider: post.provider,
          ok: result.ok,
          code: result.ok ? "OK" : result.code,
          message: result.ok ? undefined : result.message,
          post: result.ok ? result.post : result.post || safeSocialPost(fresh),
        };
      } catch (err) {
        console.error("[campaignWorker] post", post.id, (err as Error)?.message || err);
        return {
          postId: post.id,
          ok: false,
          code: "WORKER_ERROR",
          message: String((err as Error)?.message || err),
        };
      }
    });

    const summary = {
      ok: true,
      ranAt: nowIso,
      durationMs: Date.now() - startedAt,
      batchLimit,
      video: videoSummary,
      stats: statsSummary,
      daysMaterialized: dayMaterialized.length,
      postsAttempted: due.length,
      published: publishResults.filter((r) => r && r.ok === true).length,
      failed: publishResults.filter((r) => r && r.ok === false).length,
      skipped: publishResults.filter((r) => r && r.skipped).length,
      results: publishResults,
    };

    console.log(
      "[campaignWorker] summary",
      JSON.stringify({
        ...summary,
        results: undefined,
        stats: statsSummary
          ? { accounts: statsSummary.accounts, upserted: statsSummary.upserted }
          : null,
      })
    );

    if (publishBacklog) {
      kickCampaignWorkerAsync({
        skipVideo: skipVideo,
        skipStats: true,
        skipPublish: false,
        batchLimit,
      });
    }

    return Response.json({ ...summary, publishBacklog });
  } catch (error) {
    console.error("[campaignWorker]", (error as Error)?.message || error);
    return Response.json(
      {
        ok: false,
        error: "Campaign worker failed.",
        message: String((error as Error)?.message || error),
      },
      { status: 500 }
    );
  }
}
