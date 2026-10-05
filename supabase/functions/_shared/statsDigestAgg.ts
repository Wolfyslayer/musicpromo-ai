import {
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

export function statsEmailHtml(params: {
  displayName: string;
  digest: StatsDigest;
  dashboardUrl?: string;
}): string {
  const { displayName, digest } = params;
  const dashboardUrl = params.dashboardUrl || "https://musicpromo.ai/analytics";
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const { views, likes, comments, shares, streams, followers_gained } = digest.totals;
  const engagement = likes + comments + shares + digest.totals.saves;

  let platformRows = "";
  for (const p of digest.byPlatform.slice(0, 5)) {
    platformRows += `<tr><td style="padding:6px 0">${esc(p.platform)}</td><td align="right"><strong>${p.views.toLocaleString()}</strong> views</td><td align="right">${p.engagement.toLocaleString()} eng.</td></tr>`;
  }

  const emptyCopy = !digest.entryCount
    ? `<p>No analytics rows were logged for <strong>${esc(digest.dateLabel)}</strong>. Connect social accounts and publish — or tap <strong>Sync from platforms</strong> on your Analytics page.</p>`
    : "";

  return `<p>Hi ${esc(displayName || "there")},</p>
${emptyCopy}
<p>Here is your performance snapshot for <strong>${esc(digest.dateLabel)}</strong>:</p>
<ul>
  <li><strong>${views.toLocaleString()}</strong> views</li>
  <li><strong>${engagement.toLocaleString()}</strong> engagements (likes, comments, shares, saves)</li>
  <li><strong>${streams.toLocaleString()}</strong> streams</li>
  <li><strong>${followers_gained.toLocaleString()}</strong> followers gained</li>
</ul>
${platformRows ? `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${platformRows}</table>` : ""}
<p><a href="${esc(dashboardUrl)}">Open Analytics</a> in MusicPromo AI for charts and platform breakdowns.</p>
<p style="font-size:12px;color:#666">Turn off daily email or push anytime under Settings → Appearance &amp; notifications or Analytics.</p>`;
}
