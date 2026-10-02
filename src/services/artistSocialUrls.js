import { normalizeSocialConnection } from "@/services/socialService";

const URL_FIELDS = {
  instagram: "instagram_url",
  tiktok: "tiktok_url",
  youtube: "youtube_url",
  facebook: "facebook_url",
  x: "twitter_url",
};

/** Build a public profile URL from OAuth username / handle when the artist has no manual URL. */
export function publicProfileUrlForProvider(provider, username) {
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
  if (p === "facebook") {
    if (/^\d+$/.test(u)) return `https://www.facebook.com/${u}`;
    return `https://www.facebook.com/${u}`;
  }
  if (p === "x" || p === "twitter") return `https://x.com/${u}`;
  return "";
}

function connectionAppliesToArtist(connection, artistId) {
  const aid = String(artistId || "").trim();
  const cAid = String(connection.artistId || "").trim();
  if (!aid) return false;
  return cAid === aid;
}

/**
 * Fill empty artist URL fields from connected OAuth accounts scoped to this artist.
 */
export function applyConnectionUrlsToArtistForm(form, rawConnections, artistId) {
  const base = form && typeof form === "object" ? { ...form } : {};
  const connections = (rawConnections || []).map(normalizeSocialConnection);

  for (const c of connections) {
    if (c.status !== "connected" || !connectionAppliesToArtist(c, artistId)) continue;
    const field = URL_FIELDS[c.provider];
    if (!field) continue;
    const existing = String(base[field] || "").trim();
    if (existing) continue;
    const url = publicProfileUrlForProvider(c.provider, c.username);
    if (url) base[field] = url;
  }

  return base;
}

export function connectionsForArtist(rawConnections, artistId) {
  const aid = String(artistId || "").trim();
  if (!aid) return [];
  return (rawConnections || [])
    .map(normalizeSocialConnection)
    .filter((c) => c.status === "connected" && String(c.artistId || "") === aid);
}

/** Connected OAuth accounts that expose a profile photo for this artist. */
export function connectionAvatarOptions(rawConnections, artistId) {
  const labels = {
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    facebook: "Facebook",
    x: "X",
  };
  return connectionsForArtist(rawConnections, artistId)
    .map((c) => ({
      provider: c.provider,
      label: labels[c.provider] || c.provider,
      url: String(c.profileImageUrl || "").trim(),
      username: c.username,
    }))
    .filter((o) => o.url);
}

export function resolveArtistProfileImage(artist, rawConnections) {
  const opts = connectionAvatarOptions(rawConnections, artist?.id);
  const source = String(artist?.profile_image_from_provider || "").trim().toLowerCase();
  if (source && source !== "upload") {
    const pick = opts.find((o) => o.provider === source);
    if (pick?.url) return pick.url;
  }
  const manual = String(artist?.profile_image || "").trim();
  if (manual) return manual;
  return opts[0]?.url || "";
}

export function enrichArtistWithConnectionUrls(artist, rawConnections) {
  if (!artist?.id) return artist;
  const withUrls = applyConnectionUrlsToArtistForm(artist, rawConnections, artist.id);
  const profile_image = resolveArtistProfileImage(withUrls, rawConnections);
  return { ...withUrls, profile_image: profile_image || withUrls.profile_image || "" };
}

/** True when connection sync would add at least one new URL field. */
export function artistFormNeedsSocialUrlSync(form, rawConnections, artistId) {
  const merged = applyConnectionUrlsToArtistForm(form, rawConnections, artistId);
  for (const field of Object.values(URL_FIELDS)) {
    if (!String(form?.[field] || "").trim() && String(merged[field] || "").trim()) return true;
  }
  return false;
}

export const ARTIST_SOCIAL_URL_KEYS = [
  "website",
  "spotify_url",
  "youtube_url",
  "tiktok_url",
  "instagram_url",
  "facebook_url",
  "twitter_url",
];

export function pickArtistSocialUrlPatch(form) {
  const patch = {};
  for (const key of ARTIST_SOCIAL_URL_KEYS) {
    if (form[key] != null) patch[key] = form[key];
  }
  if (form.profile_image_from_provider != null) {
    patch.profile_image_from_provider = form.profile_image_from_provider;
  }
  return patch;
}

/** Merge OAuth-derived URLs into form; optionally refresh profile image from chosen provider. */
export function syncArtistFormFromConnections(form, rawConnections, artistId) {
  let next = applyConnectionUrlsToArtistForm(form, rawConnections, artistId);
  const source = String(next.profile_image_from_provider || "").trim().toLowerCase();
  if (source && source !== "upload") {
    const opt = connectionAvatarOptions(rawConnections, artistId).find((o) => o.provider === source);
    if (opt?.url) next = { ...next, profile_image: opt.url };
  } else if (!String(next.profile_image || "").trim()) {
    const first = connectionAvatarOptions(rawConnections, artistId)[0];
    if (first?.url) {
      next = {
        ...next,
        profile_image: first.url,
        profile_image_from_provider: first.provider,
      };
    }
  }
  return next;
}
