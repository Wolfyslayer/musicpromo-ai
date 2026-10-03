/** Badges, completeness, genre helpers for Community profiles. */

export type CommunityBadge = {
  id: string;
  label: string;
  tone?: "featured" | "verified" | "early" | "campaign";
};

export function genreToSlug(genre: string): string {
  return String(genre || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugToGenreLabel(slug: string): string {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function computeBadges(user: Record<string, unknown>): CommunityBadge[] {
  const badges: CommunityBadge[] = [];
  if (user.community_featured === true) {
    badges.push({ id: "featured", label: "Featured", tone: "featured" });
  }
  if (user.community_verified_at) {
    badges.push({ id: "verified", label: "Verified", tone: "verified" });
  }
  const created = Date.parse(String(user.created_at || ""));
  if (!Number.isNaN(created)) {
    const days = (Date.now() - created) / (1000 * 60 * 60 * 24);
    if (days >= 90) {
      badges.push({ id: "early", label: "Early member", tone: "early" });
    }
  }
  if (user.show_active_campaign_badge === true && user._activeCampaignLabel) {
    badges.push({
      id: "campaign",
      label: String(user._activeCampaignLabel),
      tone: "campaign",
    });
  }
  return badges;
}

export function computeCompleteness(
  user: Record<string, unknown>,
  artists: Array<Record<string, unknown>>
): { score: number; items: Array<{ id: string; label: string; done: boolean }> } {
  const visible = artists.filter((a) => a.show_on_public_profile !== false && a.is_demo !== true);
  const socialKeys = [
    "instagram_url",
    "tiktok_url",
    "youtube_url",
    "spotify_url",
    "twitter_url",
    "facebook_url",
    "website",
  ];
  let bestSocial = 0;
  for (const a of visible) {
    let n = 0;
    for (const k of socialKeys) {
      if (String(a[k] || "").trim()) n += 1;
    }
    bestSocial = Math.max(bestSocial, n);
  }
  const hasListen = visible.some((a) =>
    [a.spotify_url, a.youtube_url].some((u) => String(u || "").trim())
  );
  const items = [
    {
      id: "handle",
      label: "Public @handle",
      done: Boolean(String(user.handle || "").trim()),
    },
    {
      id: "bio",
      label: "Bio (20+ characters)",
      done: String(user.bio || "").trim().length >= 20,
    },
    {
      id: "avatar",
      label: "Profile photo",
      done: Boolean(String(user.avatar_url || "").trim()),
    },
    {
      id: "public",
      label: "Profile is public",
      done: user.profile_public !== false,
    },
    {
      id: "artist_socials",
      label: "Artist with 2+ social links",
      done: bestSocial >= 2,
    },
    {
      id: "listen",
      label: "Spotify or YouTube link",
      done: hasListen || Boolean(user.featured_release_id),
    },
  ];
  const done = items.filter((i) => i.done).length;
  const score = Math.round((done / items.length) * 100);
  return { score, items };
}

export function parseSpotifyEmbed(url: string): string | null {
  const u = String(url || "").trim();
  const m = u.match(/open\.spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/);
  if (!m) return null;
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`;
}

export function parseYouTubeEmbed(url: string): string | null {
  const u = String(url || "").trim();
  let id = "";
  const watch = u.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (watch) id = watch[1];
  const short = u.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (short) id = short[1];
  const shorts = u.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
  if (shorts) id = shorts[1];
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}`;
}

export function pickListenSource(
  featuredRelease: Record<string, unknown> | null,
  artists: Array<Record<string, unknown>>
): { type: "spotify" | "youtube"; embedUrl: string; label: string } | null {
  const candidates: string[] = [];
  if (featuredRelease?.spotify_url) candidates.push(String(featuredRelease.spotify_url));
  if (featuredRelease?.youtube_url) candidates.push(String(featuredRelease.youtube_url));
  for (const a of artists) {
    if (a.spotify_url) candidates.push(String(a.spotify_url));
    if (a.youtube_url) candidates.push(String(a.youtube_url));
  }
  for (const raw of candidates) {
    const spotify = parseSpotifyEmbed(raw);
    if (spotify) {
      return { type: "spotify", embedUrl: spotify, label: "Listen on Spotify" };
    }
    const yt = parseYouTubeEmbed(raw);
    if (yt) {
      return { type: "youtube", embedUrl: yt, label: "Listen on YouTube" };
    }
  }
  return null;
}
