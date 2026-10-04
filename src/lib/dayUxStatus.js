/** Unified launch-day status for chips across plan, launch board, and drawer. */

export const DAY_UX_STATUS = {
  draft: { label: "Draft", tone: "muted" },
  queued: { label: "Queued", tone: "primary" },
  due: { label: "Due", tone: "amber" },
  publishing: { label: "Publishing", tone: "primary" },
  live: { label: "Live", tone: "success" },
  failed: { label: "Failed", tone: "destructive" },
};

function isOverdue(iso) {
  if (!iso) return false;
  const t = Date.parse(String(iso));
  return !Number.isNaN(t) && t <= Date.now();
}

export function resolveDayUxStatus(day, posts = []) {
  if (!day) return { id: "draft", ...DAY_UX_STATUS.draft };

  const published = posts.find((p) => p.status === "published" || p.externalPermalink);
  const publishing = posts.some((p) => p.status === "publishing") || day.status === "processing";
  const failed = day.status === "failed" || posts.some((p) => p.status === "failed");
  const scheduled =
    day.status === "scheduled" || posts.some((p) => p.status === "scheduled");

  if (day.status === "posted" || published) {
    return { id: "live", ...DAY_UX_STATUS.live };
  }
  if (publishing) {
    return { id: "publishing", ...DAY_UX_STATUS.publishing };
  }
  if (failed) {
    return { id: "failed", ...DAY_UX_STATUS.failed };
  }
  if (scheduled && isOverdue(day.scheduled_at)) {
    return { id: "due", ...DAY_UX_STATUS.due };
  }
  if (scheduled) {
    return { id: "queued", ...DAY_UX_STATUS.queued };
  }
  return { id: "draft", ...DAY_UX_STATUS.draft };
}
