/** Public OAuth callbacks on the Supabase project. Register each URL in that platform's console. */
const FUNCTIONS_ORIGIN = "https://hmqxptxtcejhmuwbegvq.supabase.co/functions/v1";

export const META_OAUTH_REDIRECT_URI = `${FUNCTIONS_ORIGIN}/meta-oauth-callback`;
export const TIKTOK_OAUTH_REDIRECT_URI = `${FUNCTIONS_ORIGIN}/tiktok-oauth-callback`;
export const YOUTUBE_OAUTH_REDIRECT_URI = `${FUNCTIONS_ORIGIN}/youtube-oauth-callback`;
