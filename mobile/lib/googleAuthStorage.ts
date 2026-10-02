/** AsyncStorage keys for Google OAuth PKCE (mirrors web sessionStorage keys). */
export const GOOGLE_AUTH_STORAGE = {
  state: 'musicpromo:google_oauth_state',
  verifier: 'musicpromo:google_oauth_verifier',
  returnTo: 'musicpromo:google_oauth_return_to',
} as const;
