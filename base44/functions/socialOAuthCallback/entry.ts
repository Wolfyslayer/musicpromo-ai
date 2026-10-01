/**
 * Legacy alias — prefer metaCustomCallback.
 * Forwards to the same custom Meta OAuth handler so old redirect URIs still work during cutover.
 *
 * Token path: Instagram code exchange → credential JSON → encryptCredential()
 * (UTF-8 key / SHA-256 AES-GCM, with v0 secure-string fallback). Never blocks on atob.
 */
import handleMetaOAuthCallback from "../../shared/metaOAuthCallbackHandler.ts";

export default handleMetaOAuthCallback;
