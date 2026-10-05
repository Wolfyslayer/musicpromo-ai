import { detectBrowserTimeZone, formatDateTimeLocal } from "@/lib/userTimezone";

/** Local datetime-local value and ISO for campaignSchedule API. */

export function dayToLocalDatetimeValue(day) {
  if (!day) return "";
  const date = String(day.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const time = String(day.posting_time || "12:00").trim();
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  const hh = match ? String(match[1]).padStart(2, "0") : "12";
  const mm = match ? match[2] : "00";
  return `${date}T${hh}:${mm}`;
}

export function scheduledAtToLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localDatetimeToIso(localValue) {
  if (!localValue) return null;
  const parsed = Date.parse(localValue);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

/** HH:mm for CampaignDay.posting_time */
export function normalizePostingTime(raw) {
  const s = String(raw || "12:00").trim();
  const match = s.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "12:00";
  const h = Math.min(23, Math.max(0, Number.parseInt(match[1], 10)));
  return `${String(h).padStart(2, "0")}:${match[2]}`;
}

/** ISO scheduled_at from calendar date + daily publish time (local). */
export function postingTimeToScheduledIso(dayDate, postingTime) {
  const date = String(dayDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = normalizePostingTime(postingTime);
  return localDatetimeToIso(`${date}T${time}`);
}

/** Human-readable scheduled time in the user's browser timezone. */
export function formatScheduledAtDisplay(iso, timeZone) {
  return formatDateTimeLocal(iso, { timeZone: timeZone || detectBrowserTimeZone() });
}
