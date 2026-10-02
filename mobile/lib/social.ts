import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { Row } from "@/lib/types";

export const SOCIAL_PROVIDERS = [
  { id: "instagram", name: "Instagram", description: "Reels and feed posts.", color: "#e1306c", oauth: true },
  { id: "tiktok", name: "TikTok", description: "Short-form promo videos.", color: "#ff2d55", oauth: true },
  { id: "youtube", name: "YouTube", description: "Shorts and video posts.", color: "#ff0000", oauth: true },
  { id: "facebook", name: "Facebook", description: "Pages are not connected in the mobile app yet.", color: "#1877f2", oauth: false },
];

export async function startOAuth(provider: string, options?: { forceReauth?: boolean }) {
  return db.functions.invoke("connectSocialProvider", { provider, forceReauth: Boolean(options?.forceReauth) });
}

export async function getConnectionStatus() {
  return db.functions.invoke("socialConnectionStatus", {});
}

export async function publishPost(postId: string) {
  return db.functions.invoke("socialPublish", { postId });
}

export async function createPost(payload: Row) {
  return db.functions.invoke("socialPostCreate", payload);
}

export async function updatePost(payload: Row) {
  return db.functions.invoke("socialPostUpdate", payload);
}

export async function loadPost(postId: string) {
  return db.functions.invoke("socialPostList", { postId });
}

export async function loadPosts(filters: Row = {}) {
  return db.functions.invoke("socialPostList", filters);
}

export async function scheduleCampaignDay(payload: { campaignDayId: string }) {
  return db.functions.invoke("campaignSchedule", payload);
}

export async function syncSocialStats(socialAccountId?: string) {
  return db.functions.invoke("socialStatsSync", socialAccountId ? { socialAccountId } : {});
}

export async function triggerCampaignAutoVideo(payload: { campaignId: string; videoUrl: string }) {
  return db.functions.invoke("campaignAutoVideo", payload);
}

function unpack(row: Row) {
  const payload = row.data && typeof row.data === "object" ? row.data : {};
  return { ...payload, id: row.id, user_id: row.user_id, campaign_id: row.campaign_id ?? payload.campaign_id ?? null };
}

async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

export async function selectAnalyticsWorkspace() {
  if (!supabase) return { campaigns: [] as Row[], analytics: [] as Row[] };
  const userId = await currentUserId();
  if (!userId) return { campaigns: [], analytics: [] };
  const [campaigns, songs, artists, analytics] = await Promise.all([
    supabase.from("campaign_days").select("*").eq("user_id", userId).eq("kind", "campaign").order("created_at", { ascending: false }),
    supabase.from("prepared_media").select("*").eq("user_id", userId).eq("kind", "song"),
    supabase.from("prepared_media").select("*").eq("user_id", userId).eq("kind", "artist"),
    supabase.from("analytics_entries").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);
  const failed = [campaigns, songs, artists, analytics].find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
  const songMap = Object.fromEntries((songs.data || []).map((row) => [row.id, unpack(row)]));
  const artistMap = Object.fromEntries((artists.data || []).map((row) => [row.id, unpack(row)]));
  return {
    campaigns: (campaigns.data || []).map(unpack).filter((row) => !row.is_demo).map((campaign) => ({
      ...campaign,
      song: songMap[campaign.song_id] || null,
      artist: artistMap[campaign.artist_id] || null,
    })),
    analytics: (analytics.data || []).map(unpack).filter((row) => !row.is_demo),
  };
}

export async function selectSocialWorkspace() {
  if (!supabase) return { connections: [] as Row[], posts: [] as Row[] };
  const userId = await currentUserId();
  if (!userId) return { connections: [], posts: [] };
  const [accounts, content] = await Promise.all([
    supabase.from("social_accounts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("campaign_days").select("*").eq("user_id", userId).in("kind", ["content", "post"]).order("created_at", { ascending: false }),
  ]);
  if (accounts.error) throw new Error(accounts.error.message);
  if (content.error) throw new Error(content.error.message);
  const connections = (accounts.data || []).map((row) => {
    const payload = row.data && typeof row.data === "object" ? row.data : {};
    return { ...payload, id: row.id, provider: row.platform || payload.provider, status: payload.status || "connected" };
  });
  return { connections, posts: (content.data || []).map(unpack) };
}

export async function selectCampaignVideos(campaignId: string) {
  if (!supabase) return [];
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("prepared_media")
    .select("*")
    .eq("user_id", userId)
    .eq("kind", "video")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data || []).map(unpack);
}

export function mergeProviders(connections: Row[]) {
  const byProvider: Record<string, Row> = {};
  for (const connection of connections) {
    const id = String(connection.provider || connection.platform || "").toLowerCase();
    if (id && !byProvider[id]) byProvider[id] = connection;
  }
  return SOCIAL_PROVIDERS.map((provider) => ({
    ...provider,
    connection: byProvider[provider.id] || null,
    connected: byProvider[provider.id]?.status === "connected" || Boolean(byProvider[provider.id]),
  }));
}
