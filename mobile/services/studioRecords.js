import { supabase } from "@/lib/supabaseClient";

function unpack(row) {
  if (!row) return null;
  const payload = row.data && typeof row.data === "object" ? row.data : {};
  return {
    ...payload,
    id: row.id,
    user_id: row.user_id,
    campaign_id: row.campaign_id ?? payload.campaign_id ?? null,
    public_url: row.public_url || payload.public_url || null,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

function toJson(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (typeof item === "function") return undefined;
      if (typeof Blob !== "undefined" && item instanceof Blob) return undefined;
      return item;
    })
  );
}

async function currentUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  return data?.user?.id || null;
}

export async function selectVideoProject(id) {
  if (!supabase) throw new Error("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to open saved videos.");
  const { data, error } = await supabase
    .from("prepared_media")
    .select("*")
    .eq("id", id)
    .eq("kind", "video")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Video project not found");
  return unpack(data);
}

export async function selectCampaignDay(id) {
  if (!supabase) throw new Error("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to open this campaign day.");
  const { data, error } = await supabase
    .from("campaign_days")
    .select("*")
    .eq("id", id)
    .eq("kind", "day")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Campaign day not found");
  return unpack(data);
}

/** Insert or update a video project. Whisper lyric cues stay inside the JSONB `data` column. */
export async function saveVideoProject(payload = {}) {
  if (!supabase) throw new Error("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to save.");
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in to save.");
  const id = payload.id || crypto.randomUUID();
  const lyricCues = Array.isArray(payload.lyric_cues) ? payload.lyric_cues : [];
  const body = toJson({ ...payload, id, lyric_cues: lyricCues, lyrics: payload.lyrics || "" });
  const row = {
    user_id: userId,
    kind: "video",
    campaign_id: body.campaign_id || null,
    public_url: body.render_output_url || body.artwork_url || null,
    data: body,
    updated_at: new Date().toISOString(),
  };
  if (payload.id) {
    const { error } = await supabase.from("prepared_media").update(row).eq("id", id).eq("kind", "video");
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("prepared_media").insert({ ...row, id });
    if (error) throw new Error(error.message);
  }
  return unpack({ ...row, id, created_at: new Date().toISOString() });
}

export async function selectCampaignVideos(campaignId) {
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

export async function selectAnalyticsWorkspace() {
  if (!supabase) return { campaigns: [], analytics: [] };
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
    campaigns: (campaigns.data || [])
      .map(unpack)
      .filter((row) => !row.is_demo)
      .map((campaign) => ({
        ...campaign,
        song: songMap[campaign.song_id] || null,
        artist: artistMap[campaign.artist_id] || null,
      })),
    analytics: (analytics.data || []).map(unpack).filter((row) => !row.is_demo),
  };
}

export async function selectSocialWorkspace() {
  if (!supabase) return { connections: [], posts: [] };
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
    return {
      ...payload,
      id: row.id,
      provider: row.platform || payload.provider,
      status: payload.status || "connected",
    };
  });
  const posts = (content.data || []).map(unpack).filter((row) => row.status);
  return { connections, posts };
}

/** Store browser-generated Whisper cues on the campaign day row. */
export async function saveCampaignLyrics({ campaignId, dayId, lyricCues, lyrics }) {
  if (!supabase) throw new Error("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to save lyrics.");
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in to save lyrics.");
  const targetId = dayId || campaignId;
  const kind = dayId ? "day" : "campaign";
  if (!targetId) throw new Error("Open a campaign before saving lyrics.");

  const cues = Array.isArray(lyricCues) ? lyricCues : [];
  const text = lyrics || cues.map((cue) => cue.text).filter(Boolean).join("\n");
  const { data: existing, error: readError } = await supabase
    .from("campaign_days")
    .select("*")
    .eq("id", targetId)
    .eq("user_id", userId)
    .eq("kind", kind)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const merged = {
    ...(existing?.data && typeof existing.data === "object" ? existing.data : {}),
    id: existing?.id || targetId,
    lyric_cues: cues,
    lyrics: text,
  };
  if (!existing) {
    const { error } = await supabase.from("campaign_days").insert({
      id: targetId,
      user_id: userId,
      kind,
      campaign_id: campaignId && campaignId !== targetId ? campaignId : null,
      data: merged,
    });
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase
    .from("campaign_days")
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq("id", existing.id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteSocialAccount(id) {
  if (!supabase) throw new Error("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to disconnect.");
  const { error } = await supabase.from("social_accounts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
