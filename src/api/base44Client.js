import { createClient } from '@base44/sdk';
import { appParams, getSessionAccessToken } from '@/lib/app-params';

/**
 * Single frontend Base44 client for this app.
 *
 * All frontend code should import from this module — do not create additional
 * clients and do not fall back to silent no-op stubs.
 *
 * `base44 link` / `base44 dev` / `base44 build` inject VITE_BASE44_APP_ID.
 * Without an app ID the SDK cannot talk to your backend; fail loudly instead
 * of pretending operations succeeded.
 */
if (!appParams.appId) {
  console.error(
    '[base44] VITE_BASE44_APP_ID is missing. Run `base44 link` then `base44 dev` (or `base44 build`) so the app can reach your Base44 backend.'
  );
}

const initialToken = getSessionAccessToken() || appParams.token || undefined;

export const base44 = createClient({
  appId: appParams.appId,
  ...(initialToken ? { token: initialToken } : {}),
  ...(appParams.appBaseUrl ? { appBaseUrl: appParams.appBaseUrl } : {}),
  ...(appParams.functionsVersion ? { functionsVersion: appParams.functionsVersion } : {}),
});

/**
 * Sync the live session token onto the shared client before function calls.
 * Cookie-only SSO may have no bearer token; callers should still use credentials: "include".
 */
export function ensureClientSessionToken() {
  const token = getSessionAccessToken();
  if (!token) return null;
  try {
    if (typeof base44?.auth?.setToken === 'function') {
      base44.auth.setToken(token);
    } else if (typeof base44?.setToken === 'function') {
      base44.setToken(token);
    }
  } catch {
    /* ignore — invoke/fetch may still attach cookies */
  }
  return token;
}

/** Alias kept for call sites that historically used `db`. */
export const db = base44;

export default base44;
