/** Match supabase/functions/_shared/socialPublishCore mapDayPlatformToProviders. */

const ALLOWED = new Set(["instagram", "tiktok", "youtube", "x"]);

export function normalizeProviderId(raw) {
  const p = String(raw || "").toLowerCase().trim();
  if (p === "twitter") return "x";
  return ALLOWED.has(p) ? p : "";
}

export function mapDayPlatformToProviders(platform) {
  const p = String(platform || "").toLowerCase();
  if (!p) return ["instagram", "tiktok", "youtube", "x"];
  if (p.includes("instagram") || p.includes("reels") || p === "ig") return ["instagram"];
  if (p.includes("tiktok")) return ["tiktok"];
  if (p.includes("youtube") || p.includes("shorts")) return ["youtube"];
  if (p.includes("twitter") || p === "x" || /\bx\b/.test(p)) return ["x"];
  if (p.includes("facebook")) return [];
  return ["instagram", "tiktok", "youtube", "x"];
}

/** Single provider for manual compose / Post now. */
export function primaryProviderForDayPlatform(platform) {
  const list = mapDayPlatformToProviders(platform);
  return list[0] || "instagram";
}

/** User-selected providers on a plan day, or infer from legacy single `platform` label. */
export function resolveDayPublishProviders(day) {
  const raw = day?.publish_platforms ?? day?.publishPlatforms;
  if (Array.isArray(raw) && raw.length) {
    const ids = raw.map(normalizeProviderId).filter(Boolean);
    if (ids.length) return [...new Set(ids)];
  }
  if (typeof raw === "string" && raw.trim()) {
    const ids = raw.split(/[,;\s]+/).map(normalizeProviderId).filter(Boolean);
    if (ids.length) return [...new Set(ids)];
  }
  return mapDayPlatformToProviders(day?.platform);
}

const PROVIDER_LABELS = {
  tiktok: "TikTok",
  instagram: "Instagram Reels",
  youtube: "YouTube Shorts",
  x: "X",
};

export function formatPublishProvidersLabel(providerIds) {
  const ids = (providerIds || []).map(normalizeProviderId).filter(Boolean);
  if (!ids.length) return "";
  return ids.map((id) => PROVIDER_LABELS[id] || id).join(" · ");
}
