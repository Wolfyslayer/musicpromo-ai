const URL_FIELDS: Record<string, string> = {
  instagram: "instagram_url",
  tiktok: "tiktok_url",
  youtube: "youtube_url",
};

export function publicProfileUrlForProvider(provider: string, username: string): string {
  const p = String(provider || "").trim().toLowerCase();
  let u = String(username || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  u = u.replace(/^@+/, "");
  if (p === "instagram") return `https://www.instagram.com/${u}/`;
  if (p === "tiktok") return `https://www.tiktok.com/@${u}`;
  if (p === "youtube") {
    if (u.startsWith("UC") && u.length > 20) return `https://www.youtube.com/channel/${u}`;
    return `https://www.youtube.com/@${u}`;
  }
  return "";
}

function avatarFromSocials(
  artist: Record<string, unknown>,
  socialEntries: Array<Record<string, unknown>>
): string {
  const manual = String(artist.profile_image || "").trim();
  const source = String(artist.profile_image_from_provider || "").trim().toLowerCase();
  const connected = socialEntries.filter((s) => String(s.profileImageUrl || "").trim());

  if (source && source !== "upload") {
    const pick = connected.find((s) => String(s.provider || "").toLowerCase() === source);
    const url = String(pick?.profileImageUrl || "").trim();
    if (url) return url;
  }
  if (manual && (!source || source === "upload")) return manual;
  if (manual) return manual;
  return String(connected[0]?.profileImageUrl || "").trim();
}

export function enrichArtistRowWithSocials(
  artist: Record<string, unknown>,
  socialEntries: Array<Record<string, unknown>>
): Record<string, unknown> {
  const out = { ...artist };
  for (const s of socialEntries) {
    const provider = String(s.provider || "").toLowerCase();
    const field = URL_FIELDS[provider];
    if (!field) continue;
    const existing = String(out[field] || "").trim();
    if (existing) continue;
    const url = publicProfileUrlForProvider(provider, String(s.username || ""));
    if (url) out[field] = url;
  }
  const avatar = avatarFromSocials(out, socialEntries);
  if (avatar) out.profile_image = avatar;
  return out;
}
