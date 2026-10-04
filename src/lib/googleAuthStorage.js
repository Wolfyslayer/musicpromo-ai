import { isNativeApp } from "@/lib/nativeApp";

export const GOOGLE_AUTH_STORAGE = {
  state: "musicpromo:google_oauth_state",
  verifier: "musicpromo:google_oauth_verifier",
  returnTo: "musicpromo:google_oauth_return_to",
};

/** Native OAuth uses localStorage so PKCE survives Chrome Custom Tabs + app deep link. */
function store() {
  return isNativeApp() ? localStorage : sessionStorage;
}

export function writeGoogleSignInSession({ state, verifier, returnTo }) {
  const s = store();
  s.setItem(GOOGLE_AUTH_STORAGE.state, state);
  s.setItem(GOOGLE_AUTH_STORAGE.verifier, verifier);
  s.setItem(GOOGLE_AUTH_STORAGE.returnTo, returnTo || "/");
}

export function readGoogleSignInSession() {
  const s = store();
  return {
    state: s.getItem(GOOGLE_AUTH_STORAGE.state),
    verifier: s.getItem(GOOGLE_AUTH_STORAGE.verifier),
    returnTo: s.getItem(GOOGLE_AUTH_STORAGE.returnTo) || "/",
  };
}

export function clearGoogleSignInSessionAll() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(GOOGLE_AUTH_STORAGE.state);
    storage.removeItem(GOOGLE_AUTH_STORAGE.verifier);
    storage.removeItem(GOOGLE_AUTH_STORAGE.returnTo);
  }
}
