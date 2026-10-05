const FALLBACK_TZ = "UTC";

export function isValidIanaTimeZone(timeZone: string): boolean {
  const tz = String(timeZone || "").trim();
  if (!tz) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(raw: unknown): string {
  const tz = String(raw || "").trim();
  return isValidIanaTimeZone(tz) ? tz : FALLBACK_TZ;
}

export function normalizeNotifyTime(raw: unknown): string {
  const s = String(raw || "08:00").trim();
  const match = s.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "08:00";
  const h = Math.min(23, Math.max(0, Number.parseInt(match[1], 10)));
  return `${String(h).padStart(2, "0")}:${match[2]}`;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function zonedPartsFromUtcMs(utcMs: number, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(new Date(utcMs));
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
  };
}

export function calendarDateInTimeZone(instant: Date, timeZone: string): string {
  const p = zonedPartsFromUtcMs(instant.getTime(), normalizeTimeZone(timeZone));
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function yesterdayDateInTimeZone(timeZone: string, now = new Date()): string {
  const tz = normalizeTimeZone(timeZone);
  const today = calendarDateInTimeZone(now, tz);
  const noonUtc = Date.parse(`${today}T12:00:00Z`);
  const prev = new Date(noonUtc - 36 * 60 * 60 * 1000);
  return calendarDateInTimeZone(prev, tz);
}

export function formatDateLabelInTimeZone(dateYmd: string, timeZone: string): string {
  const tz = normalizeTimeZone(timeZone);
  const parsed = Date.parse(`${dateYmd}T12:00:00Z`);
  if (Number.isNaN(parsed)) return dateYmd;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(parsed));
}

export function timeZoneShortLabel(timeZone: string, now = new Date()): string {
  const tz = normalizeTimeZone(timeZone);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(now);
    return parts.find((p) => p.type === "timeZoneName")?.value || tz;
  } catch {
    return tz;
  }
}

export function localDateTimeInZoneToUtcIso(
  dateYmd: string,
  hhmm: string,
  timeZone: string
): string | null {
  const date = String(dateYmd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = normalizeNotifyTime(hhmm);
  const [y, mo, d] = date.split("-").map((x) => Number.parseInt(x, 10));
  const [hh, mm] = time.split(":").map((x) => Number.parseInt(x, 10));
  const tz = normalizeTimeZone(timeZone);

  let utcMs = Date.UTC(y, mo - 1, d, hh, mm, 0);
  for (let i = 0; i < 4; i++) {
    const parts = zonedPartsFromUtcMs(utcMs, tz);
    const desiredMin = hh * 60 + mm;
    const actualMin = parts.hour * 60 + parts.minute;
    let dayDelta = d - parts.day;
    if (parts.month !== mo) dayDelta = d - parts.day;
    const diffMin = desiredMin - actualMin + dayDelta * 24 * 60;
    if (diffMin === 0 && parts.year === y && parts.month === mo && parts.day === d) break;
    utcMs += diffMin * 60 * 1000;
  }
  return new Date(utcMs).toISOString();
}

export function localHourMinuteInTimeZone(timeZone: string, now = new Date()): { hour: number; minute: number } {
  const p = zonedPartsFromUtcMs(now.getTime(), normalizeTimeZone(timeZone));
  return { hour: p.hour, minute: p.minute };
}

export function shouldSendDailyStatsDigest(params: {
  timeZone: string;
  notifyTime: string;
  lastSentAt: string | null | undefined;
  now?: Date;
}): boolean {
  const tz = normalizeTimeZone(params.timeZone);
  const notify = normalizeNotifyTime(params.notifyTime);
  const [nh, nm] = notify.split(":").map((x) => Number.parseInt(x, 10));
  const now = params.now || new Date();
  const { hour, minute } = localHourMinuteInTimeZone(tz, now);
  const nowMin = hour * 60 + minute;
  const notifyMin = nh * 60 + nm;
  if (nowMin < notifyMin) return false;

  const today = calendarDateInTimeZone(now, tz);
  const last = params.lastSentAt ? Date.parse(String(params.lastSentAt)) : 0;
  if (!last || Number.isNaN(last)) return true;
  const lastDay = calendarDateInTimeZone(new Date(last), tz);
  return lastDay < today;
}
