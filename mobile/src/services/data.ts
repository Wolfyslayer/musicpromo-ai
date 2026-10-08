import { db } from "@/api/base44Client";
import type { CampaignListItem, EntityRow } from "./types";

const L = 300;

function notDemo(rows: EntityRow[] | null | undefined): EntityRow[] {
  return (rows || []).filter((r) => !r?.is_demo);
}

export async function loadArtists(): Promise<EntityRow[]> {
  return notDemo((await db.entities.Artist.list("-created_date", L)) as EntityRow[]);
}

export async function loadSongs(): Promise<EntityRow[]> {
  return notDemo((await db.entities.Song.list("-created_date", L)) as EntityRow[]);
}

export async function deleteCampaign(campaignId: string) {
  const id = String(campaignId || "");
  if (!id) throw new Error("Campaign id is required.");
  try {
    await db.functions.invoke("campaignCancelAutoPublish", { campaignId: id });
  } catch (e) {
    console.warn("[deleteCampaign] cancel auto-publish", (e as Error)?.message || e);
  }
  await db.entities.CampaignDay.deleteMany({ campaign_id: id });
  await db.entities.Campaign.delete(id);
}

export async function loadCampaigns(): Promise<CampaignListItem[]> {
  const [campaigns, songs, artists, days, videos, releases] = await Promise.all([
    db.entities.Campaign.list("-created_date", L) as Promise<EntityRow[]>,
    db.entities.Song.list("-created_date", L) as Promise<EntityRow[]>,
    db.entities.Artist.list("-created_date", L) as Promise<EntityRow[]>,
    db.entities.CampaignDay.list("-created_date", L) as Promise<EntityRow[]>,
    db.entities.VideoProject.list("-created_date", L) as Promise<EntityRow[]>,
    db.entities.Release.list("-created_date", L).catch(() => [] as EntityRow[]) as Promise<EntityRow[]>,
  ]);
  const songMap = Object.fromEntries(notDemo(songs).map((s) => [String(s.id), s]));
  const artistMap = Object.fromEntries(notDemo(artists).map((a) => [String(a.id), a]));
  const releaseMap = Object.fromEntries(notDemo(releases).map((r) => [String(r.id), r]));
  const dayCount: Record<string, number> = {};
  const dayDone: Record<string, number> = {};
  for (const d of days || []) {
    const cid = String(d.campaign_id || "");
    if (!cid) continue;
    dayCount[cid] = (dayCount[cid] || 0) + 1;
    if (d.status === "complete") dayDone[cid] = (dayDone[cid] || 0) + 1;
  }
  const vidCount: Record<string, number> = {};
  for (const v of notDemo(videos)) {
    const cid = String(v.campaign_id || "");
    if (cid) vidCount[cid] = (vidCount[cid] || 0) + 1;
  }
  return notDemo(campaigns).map((c) => {
    const id = String(c.id);
    const total = dayCount[id] || 0;
    const done = dayDone[id] || 0;
    return {
      ...c,
      song: songMap[String(c.song_id)],
      artist: artistMap[String(c.artist_id)],
      release: c.release_id ? releaseMap[String(c.release_id)] || null : null,
      daysCount: total,
      videosCount: vidCount[id] || 0,
      progressValue: total ? Math.round((done / total) * 100) : 0,
    } as CampaignListItem;
  });
}

export async function loadCampaign(id: string) {
  const campaign = (await db.entities.Campaign.get(id)) as EntityRow;
  const [song, days, analytics, videos, content, artists, release] = await Promise.all([
    campaign.song_id
      ? (db.entities.Song.get(String(campaign.song_id)).catch(() => null) as Promise<EntityRow | null>)
      : Promise.resolve(null),
    db.entities.CampaignDay.filter({ campaign_id: id }, "day_number", L) as Promise<EntityRow[]>,
    db.entities.AnalyticsEntry.filter({ campaign_id: id }, "-date", L) as Promise<EntityRow[]>,
    db.entities.VideoProject.filter({ campaign_id: id }, "-created_date", L) as Promise<EntityRow[]>,
    db.entities.GeneratedContent.filter({ campaign_id: id }, "-created_date", L) as Promise<EntityRow[]>,
    db.entities.Artist.list("-created_date", L) as Promise<EntityRow[]>,
    campaign.release_id
      ? (db.entities.Release.get(String(campaign.release_id)).catch(() => null) as Promise<EntityRow | null>)
      : Promise.resolve(null),
  ]);
  const artist =
    (artists as EntityRow[]).find((a) => a.id === campaign.artist_id) ||
    (campaign.artist_id
      ? await db.entities.Artist.get(String(campaign.artist_id)).catch(() => null)
      : null);
  return {
    campaign,
    song,
    artist: artist as EntityRow | null,
    release,
    days: days || [],
    analytics: analytics || [],
    videos: notDemo(videos as EntityRow[]),
    content: content || [],
  };
}

export async function createArtist(payload: { name: string; genre?: string }) {
  const name = String(payload.name || "").trim();
  if (!name) throw new Error("Artist name is required.");
  return db.entities.Artist.create({
    name,
    genre: payload.genre || "",
  }) as Promise<EntityRow>;
}

export async function createCampaignDraft(input: {
  title: string;
  artistId: string;
  songTitle: string;
  artworkUrl?: string;
  audioUrl?: string;
  audioFilename?: string;
  durationSec?: number | null;
  goals?: string[];
  durationDays?: number;
}) {
  const title = String(input.songTitle || input.title || "").trim();
  if (!title) throw new Error("Song title is required.");
  if (!input.artistId) throw new Error("Pick an artist.");

  const song = (await db.entities.Song.create({
    title,
    artist_id: input.artistId,
    artwork_url: input.artworkUrl || "",
    audio_url: input.audioUrl || "",
    audio_filename: input.audioFilename || "",
    duration_sec: input.durationSec ?? null,
  })) as EntityRow;

  const campaign = (await db.entities.Campaign.create({
    name: input.title || `${title} promo`,
    artist_id: input.artistId,
    song_id: song.id,
    status: "draft",
    goals: input.goals || [],
    duration_days: input.durationDays || 14,
    artwork_url: input.artworkUrl || "",
  })) as EntityRow;

  return { song, campaign };
}

export async function loadAnalyticsSummary() {
  const [campaigns, analytics] = await Promise.all([
    loadCampaigns(),
    db.entities.AnalyticsEntry.list("-date", L).catch(() => [] as EntityRow[]) as Promise<EntityRow[]>,
  ]);
  const totalViews = (analytics || []).reduce(
    (n, row) => n + (Number(row.views) || Number(row.plays) || 0),
    0
  );
  return {
    campaigns,
    analytics: analytics || [],
    totalViews,
    campaignCount: campaigns.length,
    activeCount: campaigns.filter((c) =>
      ["active", "scheduled", "preparing"].includes(String(c.status))
    ).length,
  };
}
