/** Match supabase/functions/_shared/socialPublishCore mapDayPlatformToProviders. */

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
