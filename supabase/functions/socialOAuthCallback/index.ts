/**
 * Legacy alias — prefer metaCustomCallback.
 * Multi-provider OAuth router (Instagram / TikTok / YouTube) via shared handler.
 * Publishing is NOT handled here — use socialPublish. Analytics: socialStatsSync.
 */
import handleMetaOAuthCallback from "../_shared/metaOAuthCallbackHandler.ts";

export default handleMetaOAuthCallback;


Deno.serve(handleMetaOAuthCallback);
