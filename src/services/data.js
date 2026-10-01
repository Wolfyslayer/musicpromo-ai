import { db } from '@/api/base44Client';

/**
 * Data-access helpers. Centralises entity joins so pages stay thin and the
 * data layer is easy to swap when porting off Base44 (replace these functions
 * with your own API calls; page code imports only from here).
 *
 * Ownership is enforced by entity RLS (created_by / user_id). Demo rows are
 * excluded client-side as a safety net.
 */

const L = 300;

function notDemo(rows) {
  return (rows || []).filter((r) => !r?.is_demo);
}

export async function loadArtists() {
  return notDemo(await db.entities.Artist.list("-created_date", L));
}

export async function loadSongs() {
  return notDemo(await db.entities.Song.list("-created_date", L));
}

export async function loadReleases() {
  const [releases, artists, songs, campaigns] = await Promise.all([
    db.entities.Release.list("-created_date", L),
    db.entities.Artist.list("-created_date", L),
    db.entities.Song.list("-created_date", L),
    db.entities.Campaign.list("-created_date", L),
  ]);
  const artistMap = Object.fromEntries(notDemo(artists).map((a) => [a.id, a]));
  const songCount = {};
  const campaignCount = {};
  for (const s of notDemo(songs)) {
    if (s.release_id) songCount[s.release_id] = (songCount[s.release_id] || 0) + 1;
  }
  for (const c of notDemo(campaigns)) {
    if (c.release_id) campaignCount[c.release_id] = (campaignCount[c.release_id] || 0) + 1;
  }
  return notDemo(releases).map((r) => ({
    ...r,
    artist: artistMap[r.artist_id],
    songsCount: songCount[r.id] || 0,
    campaignsCount: campaignCount[r.id] || 0,
  }));
}

export async function loadRelease(id) {
  const release = await db.entities.Release.get(id);
  const [artists, songs, campaigns, allContent, allVideos] = await Promise.all([
    db.entities.Artist.list("-created_date", L),
    db.entities.Song.list("-created_date", L),
    db.entities.Campaign.list("-created_date", L),
    db.entities.GeneratedContent.list("-created_date", L),
    db.entities.VideoProject.list("-created_date", L),
  ]);
  const artist = artists.find((a) => a.id === release.artist_id) || null;
  const releaseSongs = songs.filter((s) => s.release_id === id);
  const releaseCampaigns = campaigns.filter((c) => c.release_id === id);
  const campaignIds = new Set(releaseCampaigns.map((c) => c.id));
  const songMap = Object.fromEntries(songs.map((s) => [s.id, s]));
  const content = allContent.filter((item) => campaignIds.has(item.campaign_id));
  const videos = allVideos.filter(
    (v) => campaignIds.has(v.campaign_id) || (v.song_id && releaseSongs.some((s) => s.id === v.song_id))
  );
  const unassignedSongs = songs.filter((s) => s.artist_id === release.artist_id && !s.release_id);

  const dayLists = await Promise.all(
    releaseCampaigns.map((c) =>
      db.entities.CampaignDay.filter({ campaign_id: c.id }, "day_number", L).catch(() => [])
    )
  );
  const daysCount = dayLists.reduce((n, list) => n + (list?.length || 0), 0);
  const daysByCampaign = Object.fromEntries(
    releaseCampaigns.map((c, i) => [c.id, dayLists[i]?.length || 0])
  );

  return {
    release,
    artist,
    songs: releaseSongs,
    campaigns: releaseCampaigns.map((c) => ({
      ...c,
      song: songMap[c.song_id],
      artist,
      daysCount: daysByCampaign[c.id] || 0,
    })),
    contentCount: content.length,
    videosCount: videos.length,
    daysCount,
    unassignedSongs,
  };
}

/**
 * Calendar data for one release: campaigns with release_id + their CampaignDays.
 * CampaignDay remains the source of truth — this only joins for display.
 */
export async function loadReleaseCalendar(releaseId) {
  if (!releaseId) throw new Error("Release not found");
  let release;
  try {
    release = await db.entities.Release.get(releaseId);
  } catch {
    throw new Error("Release not found");
  }
  if (!release) throw new Error("Release not found");

  const [artists, allCampaigns] = await Promise.all([
    db.entities.Artist.list("-created_date", L),
    db.entities.Campaign.filter({ release_id: releaseId }, "-created_date", L).catch(async () => {
      const listed = await db.entities.Campaign.list("-created_date", L);
      return listed.filter((c) => c.release_id === releaseId);
    }),
  ]);
  const artist = artists.find((a) => a.id === release.artist_id) || null;
  const campaigns = allCampaigns || [];

  const dayLists = await Promise.all(
    campaigns.map((c) =>
      db.entities.CampaignDay.filter({ campaign_id: c.id }, "date", L).catch(() => [])
    )
  );

  const entries = [];
  campaigns.forEach((campaign, i) => {
    for (const day of dayLists[i] || []) {
      if (!day?.date) continue;
      entries.push({
        ...day,
        campaign,
        campaign_name: campaign.name || "Campaign",
      });
    }
  });

  entries.sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.day_number || 0) - (b.day_number || 0));

  return { release, artist, campaigns, entries };
}

export async function loadCampaigns() {
  const [campaigns, songs, artists, days, videos, releases] = await Promise.all([
    db.entities.Campaign.list("-created_date", L),
    db.entities.Song.list("-created_date", L),
    db.entities.Artist.list("-created_date", L),
    db.entities.CampaignDay.list("-created_date", L),
    db.entities.VideoProject.list("-created_date", L),
    db.entities.Release.list("-created_date", L).catch(() => []),
  ]);
  const songMap = Object.fromEntries(notDemo(songs).map((s) => [s.id, s]));
  const artistMap = Object.fromEntries(notDemo(artists).map((a) => [a.id, a]));
  const releaseMap = Object.fromEntries(notDemo(releases).map((r) => [r.id, r]));
  const dayCount = {};
  const dayDone = {};
  for (const d of days || []) {
    dayCount[d.campaign_id] = (dayCount[d.campaign_id] || 0) + 1;
    if (d.status === "complete") dayDone[d.campaign_id] = (dayDone[d.campaign_id] || 0) + 1;
  }
  const vidCount = {};
  for (const v of notDemo(videos)) vidCount[v.campaign_id] = (vidCount[v.campaign_id] || 0) + 1;
  return notDemo(campaigns).map((c) => {
    const total = dayCount[c.id] || 0;
    const done = dayDone[c.id] || 0;
    return {
      ...c,
      song: songMap[c.song_id],
      artist: artistMap[c.artist_id],
      release: c.release_id ? releaseMap[c.release_id] : null,
      daysCount: total,
      videosCount: vidCount[c.id] || 0,
      progressValue: total ? Math.round((done / total) * 100) : 0,
    };
  });
}

export async function loadCampaign(id) {
  const campaign = await db.entities.Campaign.get(id);
  const [song, days, analytics, videos, content, artists, release] = await Promise.all([
    campaign.song_id ? db.entities.Song.get(campaign.song_id) : null,
    db.entities.CampaignDay.filter({ campaign_id: id }, "day_number", L),
    db.entities.AnalyticsEntry.filter({ campaign_id: id }, "-date", L),
    db.entities.VideoProject.filter({ campaign_id: id }, "-created_date", L),
    db.entities.GeneratedContent.filter({ campaign_id: id }, "-created_date", L),
    db.entities.Artist.list("-created_date", L),
    campaign.release_id
      ? db.entities.Release.get(campaign.release_id).catch(() => null)
      : Promise.resolve(null),
  ]);
  const artist = artists.find((a) => a.id === campaign.artist_id);
  return {
    campaign,
    song,
    artist,
    days,
    analytics: notDemo(analytics),
    videos: notDemo(videos),
    content,
    release,
  };
}

/**
 * Content workspace payload for one campaign.
 * CampaignDay fields hold day-specific promo copy; GeneratedContent is campaign-level.
 */
export async function loadCampaignContent(campaignId) {
  if (!campaignId) throw new Error("Campaign not found");
  let campaign;
  try {
    campaign = await db.entities.Campaign.get(campaignId);
  } catch {
    throw new Error("Campaign not found");
  }
  if (!campaign) throw new Error("Campaign not found");

  const [song, days, videos, content, artists, release] = await Promise.all([
    campaign.song_id ? db.entities.Song.get(campaign.song_id).catch(() => null) : null,
    db.entities.CampaignDay.filter({ campaign_id: campaignId }, "day_number", L).catch(() => []),
    db.entities.VideoProject.filter({ campaign_id: campaignId }, "-created_date", L).catch(() => []),
    db.entities.GeneratedContent.filter({ campaign_id: campaignId }, "-created_date", L).catch(() => []),
    db.entities.Artist.list("-created_date", L),
    campaign.release_id
      ? db.entities.Release.get(campaign.release_id).catch(() => null)
      : Promise.resolve(null),
  ]);
  const artist = artists.find((a) => a.id === campaign.artist_id) || null;
  return {
    campaign,
    song,
    artist,
    release,
    days: days || [],
    videos: notDemo(videos || []),
    content: content || [],
  };
}

/**
 * Content for all campaigns belonging to a release (no unrelated campaigns).
 */
export async function loadReleaseContent(releaseId) {
  if (!releaseId) throw new Error("Release not found");
  let release;
  try {
    release = await db.entities.Release.get(releaseId);
  } catch {
    throw new Error("Release not found");
  }
  if (!release) throw new Error("Release not found");

  const [artists, campaigns] = await Promise.all([
    db.entities.Artist.list("-created_date", L),
    db.entities.Campaign.filter({ release_id: releaseId }, "-created_date", L).catch(async () => {
      const listed = await db.entities.Campaign.list("-created_date", L);
      return listed.filter((c) => c.release_id === releaseId);
    }),
  ]);
  const artist = artists.find((a) => a.id === release.artist_id) || null;
  const list = campaigns || [];

  const bundles = await Promise.all(
    list.map(async (campaign) => {
      const [song, days, videos, content] = await Promise.all([
        campaign.song_id ? db.entities.Song.get(campaign.song_id).catch(() => null) : null,
        db.entities.CampaignDay.filter({ campaign_id: campaign.id }, "day_number", L).catch(() => []),
        db.entities.VideoProject.filter({ campaign_id: campaign.id }, "-created_date", L).catch(() => []),
        db.entities.GeneratedContent.filter({ campaign_id: campaign.id }, "-created_date", L).catch(() => []),
      ]);
      return {
        campaign,
        song,
        days: days || [],
        videos: videos || [],
        content: content || [],
      };
    })
  );

  return { release, artist, campaigns: bundles };
}

export async function loadAnalytics() {
  return notDemo(await db.entities.AnalyticsEntry.list("-date", L));
}
