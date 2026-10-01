/** Must match the URLs registered in each platform console and in Supabase secrets. */
const FUNCTIONS_ORIGIN = "https://hmqxptxtcejhmuwbegvq.supabase.co/functions/v1";

export const OAUTH_REDIRECTS = {
  instagram: `${FUNCTIONS_ORIGIN}/meta-oauth-callback`,
  tiktok: `${FUNCTIONS_ORIGIN}/tiktok-oauth-callback`,
  youtube: `${FUNCTIONS_ORIGIN}/youtube-oauth-callback`,
};
