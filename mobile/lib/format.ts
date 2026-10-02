import { differenceInCalendarDays, format, parseISO } from "date-fns";

export const parseDateOnly = (iso?: string | null) => {
  if (!iso || typeof iso !== "string") return null;
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const toDateOnlyISO = (date: Date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return format(parseDateOnly(iso) || parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
};

export const fmtMonthYear = (date: Date) => format(date, "MMMM yyyy");

export const todayISO = () => toDateOnlyISO(new Date()) || "";

export const addDaysISO = (iso: string, days: number) => {
  const date = parseDateOnly(iso);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return toDateOnlyISO(date);
};

export const daysUntil = (iso?: string | null) => {
  const date = parseDateOnly(iso);
  if (!date) return null;
  return differenceInCalendarDays(date, new Date());
};

export const campaignProgress = (days?: { status?: string }[]) => {
  if (!days?.length) return 0;
  const done = days.filter((day) => day.status === "complete").length;
  return Math.round((done / days.length) * 100);
};

export const initials = (name = "") =>
  name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const sum = (arr: Record<string, any>[] | null | undefined, key: string) =>
  (arr || []).reduce((acc, item) => acc + (Number(item?.[key]) || 0), 0);

export function errorMessage(error: unknown, fallback = "Something went wrong") {
  return error instanceof Error ? error.message : fallback;
}
