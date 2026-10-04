import { getSettings } from "@/services/settings";
import { getPlanCopyFallbacks } from "@/services/songLanguage";

const SHORT_FORM_PLATFORMS = ["TikTok", "Instagram Reels", "YouTube Shorts"];

const CONTENT_TYPE_BIAS = [
  { match: /trend|challenge|duet|sound|viral|stitch/i, platform: "TikTok" },
  { match: /story|bts|behind|reel|visual|aesthetic|carousel|poll/i, platform: "Instagram Reels" },
  { match: /short|tutorial|lyric|performance|live|music video|teaser/i, platform: "YouTube Shorts" },
];

const GOAL_BIAS = [
  { match: /stream/i, platform: "YouTube Shorts" },
  { match: /follower|engagement/i, platform: "TikTok" },
  { match: /awareness|release|album/i, platform: "Instagram Reels" },
];

export function platformLabelToProvider(platform) {
  const p = String(platform || "").toLowerCase();
  if (p.includes("tiktok")) return "tiktok";
  if (p.includes("instagram") || p.includes("reels") || p === "ig") return "instagram";
  if (p.includes("youtube") || p.includes("shorts")) return "youtube";
  return "";
}

export function normalizeShortFormPlatform(raw, allowed = SHORT_FORM_PLATFORMS) {
  const p = String(raw || "").toLowerCase();
  if (p.includes("tiktok")) return "TikTok";
  if (p.includes("instagram") || p.includes("reels") || p === "ig") return "Instagram Reels";
  if (p.includes("youtube") || p.includes("shorts")) return "YouTube Shorts";
  const pool = allowed.length ? allowed : SHORT_FORM_PLATFORMS;
  return pool[0] || "TikTok";
}

function scorePlatform(platform, aiDay, analysis, goals) {
  let score = 0;
  const blob = `${aiDay.contentType || ""} ${aiDay.objective || ""} ${aiDay.videoConcept || ""} ${aiDay.hook || ""}`.toLowerCase();

  for (const rule of CONTENT_TYPE_BIAS) {
    if (rule.match.test(blob) && rule.platform === platform) score += 3;
  }
  for (const goal of goals || []) {
    for (const rule of GOAL_BIAS) {
      if (rule.match.test(String(goal)) && rule.platform === platform) score += 2;
    }
  }

  const recommended = (analysis?.recommendedPlatforms || [])
    .map((r) => normalizeShortFormPlatform(r))
    .filter((r) => SHORT_FORM_PLATFORMS.includes(r));

  if (recommended.includes(platform)) score += 2;
  if (recommended[0] === platform) score += 1;

  const template = String(aiDay.videoTemplate || "").toUpperCase();
  if (template === "HOOK" && platform === "TikTok") score += 1;
  if (template === "CINEMATIC" && platform === "YouTube Shorts") score += 1;
  if (template === "RELEASE" && platform === "Instagram Reels") score += 1;
  if (template === "LYRICS" && platform === "YouTube Shorts") score += 1;

  return score;
}

/**
 * Pick the best short-form platform per plan day using content type, goals,
 * song analysis, connected accounts, and light rotation across the pool.
 */
export function applyBestPlatformMatch(aiDays, { analysis, goals, defaultPlatforms, connectedProviders } = {}) {
  const settings = getSettings();
  const pool = (defaultPlatforms || settings.defaultPlatforms || SHORT_FORM_PLATFORMS).filter((p) =>
    SHORT_FORM_PLATFORMS.includes(p)
  );
  const allowed = pool.length ? pool : SHORT_FORM_PLATFORMS;
  const connected = new Set(
    (connectedProviders || []).map((p) => String(p).toLowerCase()).filter(Boolean)
  );

  return (aiDays || []).map((day, index) => {
    const candidates = allowed.map((platform) => {
      let score = scorePlatform(platform, day, analysis, goals);
      const provider = platformLabelToProvider(platform);
      if (provider && connected.has(provider)) score += 4;
      const rotIndex = allowed.indexOf(platform);
      if (rotIndex >= 0 && index % allowed.length === rotIndex) score += 1;
      return { platform, score };
    });
    candidates.sort((a, b) => b.score - a.score);
    const best =
      candidates[0]?.platform ||
      normalizeShortFormPlatform(day.platform, allowed) ||
      allowed[index % allowed.length];

    return {
      ...day,
      platform: best,
      platformMatchScore: candidates[0]?.score ?? 0,
    };
  });
}

/** Fill missing AI copy fields so every day has hook, caption, hashtags, and CTA. */
export function ensureDayCopyFields(aiDays, { song, analysis } = {}) {
  const assetHooks = analysis?.assetProfile?.hooks || [];
  const title = song?.title || "New track";
  const fallbacks = getPlanCopyFallbacks(song);
  return (aiDays || []).map((d, i) => {
    const hook =
      String(d.hook || "").trim() ||
      String(assetHooks[i % Math.max(assetHooks.length, 1)] || "").trim() ||
      fallbacks.hook(title);
    const caption = String(d.caption || "").trim() || hook;
    const cta = String(d.cta || "").trim() || fallbacks.cta;
    const hashtags = String(d.hashtags || "").trim() || fallbacks.hashtags;
    return { ...d, hook, caption, cta, hashtags };
  });
}

/** Seed Content Library rows from the generated plan (one set per day). */
export function buildGeneratedContentFromPlan(campaignId, aiDays) {
  const records = [];
  for (const d of aiDays || []) {
    const platform = d.platform || "TikTok";
    const dayNumber = d.dayNumber;
    const meta = { dayNumber, source: "campaign_generate", platform };

    if (d.hook) {
      records.push({
        campaign_id: campaignId,
        type: "hook",
        platform,
        content: d.hook,
        metadata: { ...meta, videoConcept: d.videoConcept },
      });
    }
    if (d.caption) {
      records.push({
        campaign_id: campaignId,
        type: "caption",
        platform,
        content: d.caption,
        metadata: meta,
      });
    }
    if (d.hashtags) {
      records.push({
        campaign_id: campaignId,
        type: "hashtags",
        platform,
        content: d.hashtags,
        metadata: meta,
      });
    }
    if (d.cta) {
      records.push({
        campaign_id: campaignId,
        type: "cta",
        platform,
        content: d.cta,
        metadata: meta,
      });
    }
    if (d.videoConcept) {
      records.push({
        campaign_id: campaignId,
        type: "video_concept",
        platform,
        content: d.videoConcept,
        metadata: { ...meta, videoTemplate: d.videoTemplate },
      });
    }
  }
  return records;
}

export function resolveRenderCount(renderMode, dayCount) {
  const n = Math.max(0, Number(dayCount) || 0);
  if (!n || renderMode === "skip") return 0;
  if (renderMode === "all") return n;
  if (renderMode === "first3") return Math.min(3, n);
  return Math.min(1, n);
}

export function renderModeLabel(renderMode) {
  if (renderMode === "all") return "All plan days";
  if (renderMode === "first3") return "First 3 days";
  if (renderMode === "skip") return "Drafts only (no encode)";
  return "Day 1 only";
}
