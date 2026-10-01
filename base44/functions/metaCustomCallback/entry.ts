/**
 * Custom Meta OAuth callback — explicit endpoint:
 * https://hmqxptxtcejhmuwbegvq.supabase.co/functions/v1/meta-oauth-callback
 *
 * Handles Instagram Login `code` + `state`.
 * Credentials are encrypted via socialCrypto (UTF-8 key → SHA-256 AES-GCM, v0 fallback).
 * Bypasses generic / built-in Base44 social auth callback hooks.
 */
import handleMetaOAuthCallback from "../../shared/metaOAuthCallbackHandler.ts";

export default handleMetaOAuthCallback;
