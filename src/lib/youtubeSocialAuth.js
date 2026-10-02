/** Redirect URI for YouTube channel connect (must match Google Cloud + token exchange). */
export function getYouTubeConnectRedirectUri() {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${window.location.origin}${base}/auth/youtube/callback`;
}
