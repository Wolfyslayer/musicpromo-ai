import AsyncStorage from "@react-native-async-storage/async-storage";

export const GOOGLE_AUTH_STORAGE = {
  state: "musicpromo:google_oauth_state",
  verifier: "musicpromo:google_oauth_verifier",
  returnTo: "musicpromo:google_oauth_return_to",
};

export async function writeGoogleSignInSession({
  state,
  verifier,
  returnTo,
}: {
  state: string;
  verifier: string;
  returnTo: string;
}) {
  await AsyncStorage.multiSet([
    [GOOGLE_AUTH_STORAGE.state, state],
    [GOOGLE_AUTH_STORAGE.verifier, verifier],
    [GOOGLE_AUTH_STORAGE.returnTo, returnTo || "/"],
  ]);
}

export async function readGoogleSignInSession() {
  const pairs = await AsyncStorage.multiGet([
    GOOGLE_AUTH_STORAGE.state,
    GOOGLE_AUTH_STORAGE.verifier,
    GOOGLE_AUTH_STORAGE.returnTo,
  ]);
  const map = Object.fromEntries(pairs);
  return {
    state: map[GOOGLE_AUTH_STORAGE.state],
    verifier: map[GOOGLE_AUTH_STORAGE.verifier],
    returnTo: map[GOOGLE_AUTH_STORAGE.returnTo] || "/",
  };
}

export async function clearGoogleSignInSessionAll() {
  await AsyncStorage.multiRemove([
    GOOGLE_AUTH_STORAGE.state,
    GOOGLE_AUTH_STORAGE.verifier,
    GOOGLE_AUTH_STORAGE.returnTo,
  ]);
}
