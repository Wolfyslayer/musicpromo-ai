import { addDaysISO } from "@/services/format";

/** Campaign start so the last plan day falls on `releaseDateIso`. */
export function computeCampaignStartForReleaseDate(releaseDateIso, durationDays) {
  const days = Number(durationDays) || 7;
  if (!releaseDateIso || days < 1) return releaseDateIso || null;
  return addDaysISO(releaseDateIso, -(days - 1));
}

export function campaignEndDate(startDateIso, durationDays) {
  const days = Number(durationDays) || 7;
  if (!startDateIso || days < 1) return startDateIso || null;
  return addDaysISO(startDateIso, days - 1);
}

/**
 * Pick track campaign start: honor stagger when it still ends on/before release;
 * otherwise anchor the window to end on release day.
 */
export function resolveTrackCampaignStart({
  releaseDate,
  durationDays,
  staggeredStart,
  fallbackStart,
}) {
  const start = staggeredStart || fallbackStart;
  if (!releaseDate) return start;
  const anchored = computeCampaignStartForReleaseDate(releaseDate, durationDays);
  const end = campaignEndDate(start, durationDays);
  if (end && end <= releaseDate) return start;
  return anchored || start;
}

/**
 * Fix calendar dates from startDate + dayNumber; mark release day with RELEASE template.
 */
export function normalizePlanDayDates(
  aiDays,
  { startDate, durationDays, releaseDate, songTitle = "", releaseTitle = "" } = {}
) {
  const days = Number(durationDays) || (aiDays?.length ?? 7);
  const start = startDate;
  const releaseEnd = releaseDate || campaignEndDate(start, days);
  const title = releaseTitle || songTitle || "New release";

  return (aiDays || [])
    .map((d, index) => {
      const dayNumber = Number(d.dayNumber ?? d.day_number) || index + 1;
      const date = addDaysISO(start, dayNumber - 1) || d.date;
      const isReleaseDay = Boolean(releaseEnd && date === releaseEnd);
      let videoTemplate = d.videoTemplate || d.video_template;
      let contentType = d.contentType || d.content_type;
      let objective = d.objective;
      let hook = d.hook;

      if (isReleaseDay) {
        videoTemplate = "RELEASE";
        contentType = contentType || "release_announcement";
        objective = objective || "Drive streams on release day";
        hook =
          String(hook || "").trim() ||
          (releaseDate ? `${title} — out ${formatReleaseHookDate(releaseEnd)}` : `${title} — out now`);
      } else if (releaseEnd && date && date < releaseEnd) {
        objective = objective || "Build anticipation before release";
        if (!videoTemplate || videoTemplate === "RELEASE") videoTemplate = "HOOK";
      }

      return {
        ...d,
        dayNumber,
        date,
        videoTemplate,
        contentType,
        objective,
        hook,
        isReleaseDay,
      };
    })
    .sort((a, b) => a.dayNumber - b.dayNumber);
}

function formatReleaseHookDate(iso) {
  if (!iso) return "today";
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
