/** Client-side mirrors of supabase/functions/_shared/communityProfile.ts (keep in sync). */

export function genreToSlug(genre) {
  return String(genre || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugToGenreLabel(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function computeCompleteness(user, artists) {
  const visible = (artists || []).filter((a) => a.show_on_public_profile !== false && a.is_demo !== true);
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
      done: Boolean(String(user?.handle || "").trim()),
    },
    {
      id: "bio",
      label: "Bio (20+ characters)",
      done: String(user?.bio || "").trim().length >= 20,
    },
    {
      id: "avatar",
      label: "Profile photo",
      done: Boolean(String(user?.avatar_url || "").trim()),
    },
    {
      id: "public",
      label: "Profile is public",
      done: user?.profile_public !== false,
    },
    {
      id: "artist_socials",
      label: "Artist with 2+ social links",
      done: bestSocial >= 2,
    },
    {
      id: "listen",
      label: "Spotify or YouTube link",
      done: hasListen || Boolean(user?.featured_release_id),
    },
  ];
  const done = items.filter((i) => i.done).length;
  return { score: Math.round((done / items.length) * 100), items };
}
