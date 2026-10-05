/** Browser IANA timezone + formatting helpers for schedules and digests. */

export function detectBrowserTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && String(tz).trim() ? String(tz).trim() : "UTC";
  } catch {
    return "UTC";
  }
}

export function normalizeNotifyTime(raw) {
  const s = String(raw || "08:00").trim();
  const match = s.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "08:00";
  const h = Math.min(23, Math.max(0, Number.parseInt(match[1], 10)));
  return `${String(h).padStart(2, "0")}:${match[2]}`;
}

export function formatDateTimeLocal(iso, options = {}) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const timeZone = options.timeZone || detectBrowserTimeZone();
  return d.toLocaleString(undefined, {
    timeZone,
    dateStyle: options.dateStyle ?? "medium",
    timeStyle: options.timeStyle ?? "short",
  });
}

export function timeZoneShortLabel(timeZone, date = new Date()) {
  const tz = timeZone || detectBrowserTimeZone();
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value || tz;
  } catch {
    return tz;
  }
}

export function formatCalendarDateLabel(dateYmd, timeZone) {
  const tz = timeZone || detectBrowserTimeZone();
  const parsed = Date.parse(`${dateYmd}T12:00:00Z`);
  if (Number.isNaN(parsed)) return dateYmd;
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(parsed));
}
