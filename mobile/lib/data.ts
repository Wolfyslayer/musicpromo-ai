import { db } from "@/lib/db";
import type { Row } from "@/lib/types";

const L = 300;

function notDemo(rows: Row[] | null | undefined) {
  return (rows || []).filter((row) => !row?.is_demo);
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
  const artistMap = Object.fromEntries(notDemo(artists).map((artist) => [artist.id, artist]));
  const songCount: Record<string, number> = {};
  const campaignCount: Record<string, number> = {};
  for (const song of notDemo(songs)) {
    if (song.release_id) songCount[song.release_id] = (songCount[song.release_id] || 0) + 1;
  }
  for (const campaign of notDemo(campaigns)) {
    if (campaign.release_id) campaignCount[campaign.release_id] = (campaignCount[campaign.release_id] || 0) + 1;
  }
  return notDemo(releases).map((release) => ({
    ...release,
    artist: artistMap[release.artist_id],
    songsCount: songCount[release.id] || 0,
    campaignsCount: campaignCount[release.id] || 0,
  }));
}

export async function loadRelease(id: string) {
  const release = await db.entities.Release.get(id);
  const [artists, songs, campaigns, allContent, allVideos] = await Promise.all([
    db.entities.Artist.list("-created_date", L),
    db.entities.Song.list("-created_date", L),
    db.entities.Campaign.list("-created_date", L),
    db.entities.GeneratedContent.list("-created_date", L),
    db.entities.VideoProject.list("-created_date", L),
  ]);
  const artist = artists.find((item) => item.id === release.artist_id) || null;
  const releaseSongs = songs.filter((song) => song.release_id === id);
  const releaseCampaigns = campaigns.filter((campaign) => campaign.release_id === id);
  const campaignIds = new Set(releaseCampaigns.map((campaign) => campaign.id));
  const songMap = Object.fromEntries(songs.map((song) => [song.id, song]));
  const content = allContent.filter((item) => campaignIds.has(item.campaign_id));
  const videos = allVideos.filter(
    (video) => campaignIds.has(video.campaign_id) || (video.song_id && releaseSongs.some((song) => song.id === video.song_id))
  );
  return {
    release,
    artist,
    songs: releaseSongs,
    campaigns: releaseCampaigns.map((campaign) => ({
      ...campaign,
      song: songMap[campaign.song_id],
      artist,
    })),
    contentCount: content.length,
    videosCount: videos.length,
  };
}

export async function loadReleaseCalendar(releaseId: string) {
  const release = await db.entities.Release.get(releaseId);
  const [artists, campaigns] = await Promise.all([
    db.entities.Artist.list("-created_date", L),
    db.entities.Campaign.filter({ release_id: releaseId }, "-created_date", L),
  ]);
  const artist = artists.find((item) => item.id === release.artist_id) || null;
  const dayLists = await Promise.all(
    campaigns.map((campaign) => db.entities.CampaignDay.filter({ campaign_id: campaign.id }, "date", L).catch(() => []))
  );
  const entries: Row[] = [];
  campaigns.forEach((campaign, index) => {
    for (const day of dayLists[index] || []) {
      if (!day?.date) continue;
      entries.push({ ...day, campaign, campaign_name: campaign.name || "Campaign" });
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
  const songMap = Object.fromEntries(notDemo(songs).map((song) => [song.id, song]));
  const artistMap = Object.fromEntries(notDemo(artists).map((artist) => [artist.id, artist]));
  const releaseMap = Object.fromEntries(notDemo(releases).map((release) => [release.id, release]));
  const dayCount: Record<string, number> = {};
  const dayDone: Record<string, number> = {};
  for (const day of days || []) {
    dayCount[day.campaign_id] = (dayCount[day.campaign_id] || 0) + 1;
    if (day.status === "complete") dayDone[day.campaign_id] = (dayDone[day.campaign_id] || 0) + 1;
  }
  const videoCount: Record<string, number> = {};
  for (const video of notDemo(videos)) videoCount[video.campaign_id] = (videoCount[video.campaign_id] || 0) + 1;
  return notDemo(campaigns).map((campaign): Row => {
    const total = dayCount[campaign.id] || 0;
    const done = dayDone[campaign.id] || 0;
    return {
      ...campaign,
      song: songMap[campaign.song_id],
      artist: artistMap[campaign.artist_id],
      release: campaign.release_id ? releaseMap[campaign.release_id] : null,
      daysCount: total,
      videosCount: videoCount[campaign.id] || 0,
      progressValue: total ? Math.round((done / total) * 100) : 0,
    };
  });
}

export async function loadCampaign(id: string) {
  const campaign = await db.entities.Campaign.get(id);
  const [song, days, analytics, videos, content, artists, release] = await Promise.all([
    campaign.song_id ? db.entities.Song.get(campaign.song_id).catch(() => null) : null,
    db.entities.CampaignDay.filter({ campaign_id: id }, "day_number", L),
    db.entities.AnalyticsEntry.filter({ campaign_id: id }, "-date", L),
    db.entities.VideoProject.filter({ campaign_id: id }, "-created_date", L),
    db.entities.GeneratedContent.filter({ campaign_id: id }, "-created_date", L),
    db.entities.Artist.list("-created_date", L),
    campaign.release_id ? db.entities.Release.get(campaign.release_id).catch(() => null) : Promise.resolve(null),
  ]);
  const artist = artists.find((item) => item.id === campaign.artist_id);
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

export async function loadCampaignContent(campaignId: string) {
  const campaign = await db.entities.Campaign.get(campaignId);
  const [song, days, videos, content, artists, release] = await Promise.all([
    campaign.song_id ? db.entities.Song.get(campaign.song_id).catch(() => null) : null,
    db.entities.CampaignDay.filter({ campaign_id: campaignId }, "day_number", L).catch(() => []),
    db.entities.VideoProject.filter({ campaign_id: campaignId }, "-created_date", L).catch(() => []),
    db.entities.GeneratedContent.filter({ campaign_id: campaignId }, "-created_date", L).catch(() => []),
    db.entities.Artist.list("-created_date", L),
    campaign.release_id ? db.entities.Release.get(campaign.release_id).catch(() => null) : Promise.resolve(null),
  ]);
  return {
    campaign,
    song,
    artist: artists.find((item) => item.id === campaign.artist_id) || null,
    release,
    days: days || [],
    videos: notDemo(videos || []),
    content: content || [],
  };
}

export async function loadReleaseContent(releaseId: string) {
  const release = await db.entities.Release.get(releaseId);
  const [artists, campaigns] = await Promise.all([
    db.entities.Artist.list("-created_date", L),
    db.entities.Campaign.filter({ release_id: releaseId }, "-created_date", L),
  ]);
  const artist = artists.find((item) => item.id === release.artist_id) || null;
  const bundles = await Promise.all(
    (campaigns || []).map(async (campaign) => {
      const [song, days, content] = await Promise.all([
        campaign.song_id ? db.entities.Song.get(campaign.song_id).catch(() => null) : null,
        db.entities.CampaignDay.filter({ campaign_id: campaign.id }, "day_number", L).catch(() => []),
        db.entities.GeneratedContent.filter({ campaign_id: campaign.id }, "-created_date", L).catch(() => []),
      ]);
      return { campaign, song, days: days || [], content: content || [] };
    })
  );
  return { release, artist, campaigns: bundles };
}

export async function loadAnalytics() {
  return notDemo(await db.entities.AnalyticsEntry.list("-date", L));
}
