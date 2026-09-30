import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

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

export const base44 = createClient({
  appId: appParams.appId,
  ...(appParams.token ? { token: appParams.token } : {}),
  ...(appParams.appBaseUrl ? { appBaseUrl: appParams.appBaseUrl } : {}),
  ...(appParams.functionsVersion ? { functionsVersion: appParams.functionsVersion } : {}),
});

/** Alias kept for call sites that historically used `db`. */
export const db = base44;

export default base44;
