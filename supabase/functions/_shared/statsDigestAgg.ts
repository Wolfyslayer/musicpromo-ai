import {
  calendarDateInTimeZone,
  formatDateLabelInTimeZone,
  normalizeTimeZone,
  yesterdayDateInTimeZone,
} from "./timezone.ts";

const METRICS = [
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
  "followers_gained",
  "streams",
  "playlist_adds",
  "clicks",
] as const;

export type StatsDigest = {
  date: string;
  dateLabel: string;
  totals: Record<(typeof METRICS)[number], number>;
  byPlatform: { platform: string; views: number; engagement: number }[];
  entryCount: number;
};

export function unpackAnalyticsRow(row: Record<string, unknown>) {
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  return { ...data, id: row.id, user_id: row.user_id };
}

export function yesterdayUtcDate(): string {
  return yesterdayDateInTimeZone("UTC");
}

export function yesterdayForUserTimeZone(timeZone: string): string {
  return yesterdayDateInTimeZone(normalizeTimeZone(timeZone));
}

function sumMetric(rows: Record<string, unknown>[], key: string): number {
  let n = 0;
  for (const row of rows) {
    n += Number(row[key] || 0);
  }
  return n;
}

function normalizePlatform(name: unknown): string {
  const n = String(name || "").toLowerCase();
  if (n.includes("instagram")) return "Instagram";
  if (n.includes("tiktok")) return "TikTok";
  if (n.includes("youtube") || n.includes("short")) return "YouTube";
  if (n.includes("spotify")) return "Spotify";
  const raw = String(name || "").trim();
  return raw || "Other";
}

export function aggregateDailyStats(
  rawRows: Record<string, unknown>[],
  targetDate: string,
  timeZone = "UTC"
): StatsDigest {
  const tz = normalizeTimeZone(timeZone);
  const rows = (rawRows || [])
    .map(unpackAnalyticsRow)
    .filter((r) => r.is_demo !== true && String(r.date || "") === targetDate);

  const totals = {} as StatsDigest["totals"];
  for (const m of METRICS) totals[m] = sumMetric(rows, m);

  const platformMap: Record<string, { views: number; engagement: number }> = {};
  for (const r of rows) {
    const key = normalizePlatform(r.platform);
    if (!platformMap[key]) platformMap[key] = { views: 0, engagement: 0 };
    platformMap[key].views += Number(r.views || 0);
    platformMap[key].engagement +=
      Number(r.likes || 0) +
      Number(r.comments || 0) +
      Number(r.shares || 0) +
      Number(r.saves || 0);
  }

  const byPlatform = Object.entries(platformMap)
    .map(([platform, v]) => ({ platform, ...v }))
    .sort((a, b) => b.views - a.views);

  return {
    date: targetDate,
    dateLabel: formatDateLabelInTimeZone(targetDate, tz),
    totals,
    byPlatform,
    entryCount: rows.length,
  };
}

/** Prefer today / yesterday (user TZ + UTC) so digests match hourly platform sync rows. */
export function aggregateDailyStatsForDigest(
  rawRows: Record<string, unknown>[],
  timeZone: string,
  now = new Date()
): StatsDigest {
  const tz = normalizeTimeZone(timeZone);
  const utcToday = now.toISOString().slice(0, 10);
  const today = calendarDateInTimeZone(now, tz);
  const yesterday = yesterdayDateInTimeZone(tz, now);
  const candidates = [...new Set([today, yesterday, utcToday])];

  for (const d of candidates) {
    const digest = aggregateDailyStats(rawRows, d, tz);
    if (digest.entryCount > 0) return digest;
  }

  const rows = (rawRows || []).map(unpackAnalyticsRow).filter((r) => r.is_demo !== true);
  if (!rows.length) {
    return aggregateDailyStats(rawRows, today, tz);
  }

  const totals = {} as StatsDigest["totals"];
  for (const m of METRICS) totals[m] = sumMetric(rows, m);
  const platformMap: Record<string, { views: number; engagement: number }> = {};
  for (const r of rows) {
    const key = normalizePlatform(r.platform);
    if (!platformMap[key]) platformMap[key] = { views: 0, engagement: 0 };
    platformMap[key].views += Number(r.views || 0);
    platformMap[key].engagement +=
      Number(r.likes || 0) +
      Number(r.comments || 0) +
      Number(r.shares || 0) +
      Number(r.saves || 0);
  }
  const byPlatform = Object.entries(platformMap)
    .map(([platform, v]) => ({ platform, ...v }))
    .sort((a, b) => b.views - a.views);

  return {
    date: today,
    dateLabel: formatDateLabelInTimeZone(today, tz),
    totals,
    byPlatform,
    entryCount: rows.length,
  };
}

export function statsPushBody(digest: StatsDigest): string {
  const { views, likes, comments, shares, streams } = digest.totals;
  const engagement = likes + comments + shares + digest.totals.saves;
  if (!digest.entryCount) {
    return `No stats logged for ${digest.dateLabel}. Publish or sync from Social Hub to track performance.`;
  }
  const top = digest.byPlatform[0];
  const topBit = top ? ` · Top: ${top.platform}` : "";
  return `${views.toLocaleString()} views, ${engagement.toLocaleString()} engagements${streams ? `, ${streams.toLocaleString()} streams` : ""}${topBit}`;
}

export function statsEmailSubject(digest: StatsDigest): string {
  const views = digest.totals.views;
  if (!digest.entryCount) return `Daily stats — ${digest.dateLabel}`;
  return `Daily stats — ${views.toLocaleString()} views on ${digest.dateLabel}`;
}

/** Matches app PUBLIC_APP_URL → Analytics route. */
export function resolveDailyStatsDashboardUrl(appPublicUrl?: string): string {
  const base = String(appPublicUrl || "").trim().replace(/\/$/, "");
  if (base) return `${base}/analytics`;
  return "https://musicpromoai.site/analytics";
}

const EMAIL_LOCALE = "en-US";

function fmtNum(n: number): string {
  return Number(n || 0).toLocaleString(EMAIL_LOCALE);
}

function platformBrand(platform: string): { color: string; abbr: string } {
  const n = String(platform || "").toLowerCase();
  if (n.includes("instagram")) return { color: "#e1306c", abbr: "IG" };
  if (n.includes("tiktok")) return { color: "#ff2d55", abbr: "TT" };
  if (n.includes("youtube") || n.includes("short")) return { color: "#ff0000", abbr: "YT" };
  if (n.includes("spotify")) return { color: "#1db954", abbr: "SP" };
  const raw = String(platform || "Other").trim();
  return { color: "#9d6df7", abbr: raw.slice(0, 2).toUpperCase() || "?" };
}

function emailStatCard(label: string, value: string): string {
  return `<td width="50%" style="padding:0 6px 12px 6px;vertical-align:top">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #2a2a30;border-radius:16px;background:#141418">
    <tr><td style="padding:14px 16px 16px 16px">
      <p style="margin:0 0 6px 0;font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8b8b95;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${label}</p>
      <p style="margin:0;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${value}</p>
    </td></tr>
  </table>
</td>`;
}

function emailPlatformCard(p: { platform: string; views: number; engagement: number }): string {
  const { color, abbr } = platformBrand(p.platform);
  const rate = p.views > 0 ? ((p.engagement / p.views) * 100).toFixed(1) : "0.0";
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:10px;border:1px solid #2a2a30;border-radius:16px;background:#141418">
  <tr><td style="padding:14px 16px">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
      <td width="44" style="vertical-align:top">
        <div style="width:36px;height:36px;line-height:36px;border-radius:999px;text-align:center;font-size:11px;font-weight:700;color:${color};background:${color}22;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${esc(abbr)}</div>
      </td>
      <td style="vertical-align:middle;padding-left:4px">
        <p style="margin:0;font-size:14px;font-weight:600;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${esc(p.platform)}</p>
        <p style="margin:2px 0 0 0;font-size:12px;color:#8b8b95;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${rate}% engagement rate</p>
      </td>
      <td align="right" style="vertical-align:middle">
        <p style="margin:0;font-size:16px;font-weight:600;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${fmtNum(p.views)}</p>
        <p style="margin:2px 0 0 0;font-size:11px;color:#8b8b95;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">views · ${fmtNum(p.engagement)} eng.</p>
      </td>
    </tr></table>
  </td></tr>
</table>`;
}

export function statsEmailHtml(params: {
  displayName: string;
  digest: StatsDigest;
  dashboardUrl?: string;
}): string {
  const { displayName, digest } = params;
  const dashboardUrl = params.dashboardUrl || resolveDailyStatsDashboardUrl();
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const { views, likes, comments, shares, streams, followers_gained } = digest.totals;
  const engagement = likes + comments + shares + digest.totals.saves;
  const name = esc(displayName || "there");

  const metricGrid = `<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
  <tr>${emailStatCard("Total views", fmtNum(views))}${emailStatCard("Engagement", fmtNum(engagement))}</tr>
  <tr>${emailStatCard("Streams", fmtNum(streams))}${emailStatCard("Followers +", fmtNum(followers_gained))}</tr>
</table>`;

  const platformBlock =
    digest.byPlatform.length > 0
      ? `<p style="margin:24px 0 10px 0;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8b8b95;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">By platform</p>
${digest.byPlatform
  .slice(0, 4)
  .map((p) => emailPlatformCard(p))
  .join("")}`
      : "";

  const emptyBanner = !digest.entryCount
    ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px 0;border:1px solid #b4530940;border-radius:14px;background:#b4530918">
  <tr><td style="padding:12px 14px;font-size:13px;line-height:1.5;color:#fcd34d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
    No analytics rows for <strong style="color:#fef3c7">${esc(digest.dateLabel)}</strong>. Connect social accounts, publish from Social Hub, or tap <strong>Sync now</strong> on Analytics.
  </td></tr>
</table>`
    : "";

  const rowsNote =
    digest.entryCount > 0
      ? `<p style="margin:16px 0 0 0;font-size:12px;color:#8b8b95;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${fmtNum(digest.entryCount)} synced row${digest.entryCount === 1 ? "" : "s"} in this snapshot</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>Daily stats — ${esc(digest.dateLabel)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0c;-webkit-text-size-adjust:100%">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0a0a0c;background-image:radial-gradient(120% 70% at 50% -20%, #9d6df712, transparent 55%)">
    <tr><td align="center" style="padding:32px 16px 40px 16px">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px">
        <tr><td style="padding-bottom:20px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-radius:20px;background:linear-gradient(120deg,#9d6df7,#e84d9a);padding:1px">
            <tr><td style="border-radius:19px;background:#121214;padding:20px 22px">
              <p style="margin:0 0 6px 0;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#c4b5fd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">Performance</p>
              <p style="margin:0;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">Daily stats digest</p>
              <p style="margin:8px 0 0 0;font-size:13px;line-height:1.45;color:#d4d4d8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
                Hi ${name} — snapshot for <strong style="color:#fafafa">${esc(digest.dateLabel)}</strong>
              </p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td>
          ${emptyBanner}
          ${metricGrid}
          ${rowsNote}
          ${platformBlock}
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px">
            <tr><td align="center">
              <a href="${esc(dashboardUrl)}" style="display:inline-block;padding:12px 28px;border-radius:999px;background:linear-gradient(120deg,#9d6df7,#e84d9a);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">Open Analytics</a>
            </td></tr>
          </table>
          <p style="margin:28px 0 0 0;font-size:11px;line-height:1.5;color:#6b6b76;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
            Turn off daily email or push anytime under Settings → Appearance &amp; notifications or Analytics in MusicPromo AI.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
