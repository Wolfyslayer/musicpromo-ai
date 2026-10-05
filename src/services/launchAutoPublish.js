import { db } from "@/api/base44Client";
import { normalizePostingTime, postingTimeToScheduledIso } from "@/lib/campaignDaySchedule";
import { scheduleCampaignDay } from "@/services/socialService";

const SKIP_STATUSES = new Set(["processing", "posted", "complete"]);

/**
 * Set the same daily posting_time on each day and queue campaignSchedule (auto-publish).
 */
export async function bulkAutoPublishCampaignDays(days, postingTime) {
  const time = normalizePostingTime(postingTime);
  const results = { scheduled: 0, skipped: 0, failed: 0, errors: [] };

  for (const day of days || []) {
    if (!day?.id) continue;
    const status = String(day.status || "").toLowerCase();
    if (SKIP_STATUSES.has(status)) {
      results.skipped += 1;
      continue;
    }
    const scheduledAt = postingTimeToScheduledIso(day.date, time);
    if (!scheduledAt) {
      results.skipped += 1;
      continue;
    }
    try {
      await db.entities.CampaignDay.update(day.id, { posting_time: time });
      const res = await scheduleCampaignDay({ campaignDayId: day.id, scheduledAt });
      if (res?.ok) {
        results.scheduled += 1;
      } else {
        results.failed += 1;
        const msg = res?.error || "Schedule failed";
        if (!results.errors.includes(msg)) results.errors.push(msg);
      }
    } catch (e) {
      results.failed += 1;
      const msg = e?.message || "Schedule failed";
      if (!results.errors.includes(msg)) results.errors.push(msg);
    }
  }

  return results;
}

export function defaultBulkPostingTime(days) {
  const first = (days || []).find((d) => d?.posting_time);
  if (first?.posting_time) return normalizePostingTime(first.posting_time);
  return "17:00";
}

export function countSchedulableDays(days) {
  return (days || []).filter((d) => {
    if (!d?.id || !d?.date) return false;
    return !SKIP_STATUSES.has(String(d.status || "").toLowerCase());
  }).length;
}
