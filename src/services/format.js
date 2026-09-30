/** Small formatting helpers shared across pages. */
import { format, parseISO, differenceInCalendarDays } from "date-fns";

export const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return format(parseDateOnly(iso) || parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
};

export const fmtDateShort = (iso) => {
  if (!iso) return "—";
  try {
    return format(parseDateOnly(iso) || parseISO(iso), "MMM d");
  } catch {
    return iso;
  }
};

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC day-shift). */
export const parseDateOnly = (iso) => {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};

export const toDateOnlyISO = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const fmtMonthYear = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";
  return format(date, "MMMM yyyy");
};

export const todayISO = () => toDateOnlyISO(new Date());

export const addDaysISO = (iso, days) => {
  const d = parseDateOnly(iso);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return toDateOnlyISO(d);
};

export const daysUntil = (iso) => {
  const d = parseDateOnly(iso);
  if (!d) return null;
  try {
    return differenceInCalendarDays(d, new Date());
  } catch {
    return null;
  }
};

export const fmtDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const campaignProgress = (days) => {
  if (!days || !days.length) return 0;
  const done = days.filter((d) => d.status === "complete").length;
  return Math.round((done / days.length) * 100);
};

export const initials = (name = "") =>
  name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const sum = (arr, key) => (arr || []).reduce((acc, x) => acc + (Number(x?.[key]) || 0), 0);