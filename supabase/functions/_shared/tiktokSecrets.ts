/**
 * TikTok Login Kit / Content Posting credentials (production vs sandbox).
 *
 * Set Supabase secrets:
 *   TIKTOK_CREDENTIALS_MODE=production|sandbox  (default production)
 *   Production: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
 *   Sandbox:    TIKTOK_SANDBOX_CLIENT_KEY, TIKTOK_SANDBOX_CLIENT_SECRET
 *
 * Same API hosts for both modes — only client key/secret change in Developer Portal.
 */

import { secrets } from "./runtime.ts";

export type TikTokCredentialsMode = "production" | "sandbox";

export function resolveTikTokCredentialsMode(): TikTokCredentialsMode {
  const raw = String(
    secrets.get("TIKTOK_CREDENTIALS_MODE") || secrets.get("TIKTOK_MODE") || "production"
  )
    .trim()
    .toLowerCase();
  if (raw === "sandbox" || raw === "test" || raw === "staging") return "sandbox";
  return "production";
}

function secretTrim(name: string): string {
  try {
    return String(secrets.get(name) || "").trim();
  } catch {
    return "";
  }
}

export function getTikTokAppCredentials(): {
  mode: TikTokCredentialsMode;
  clientKey: string;
  clientSecret: string;
} {
  const mode = resolveTikTokCredentialsMode();
  if (mode === "sandbox") {
    const clientKey =
      secretTrim("TIKTOK_SANDBOX_CLIENT_KEY") || secretTrim("TIKTOK_SANDBOX_CLIENT_ID");
    const clientSecret = secretTrim("TIKTOK_SANDBOX_CLIENT_SECRET");
    return { mode, clientKey, clientSecret };
  }
  const clientKey = secretTrim("TIKTOK_CLIENT_KEY") || secretTrim("TIKTOK_CLIENT_ID");
  const clientSecret = secretTrim("TIKTOK_CLIENT_SECRET");
  return { mode, clientKey, clientSecret };
}

export function isTikTokAppConfigured(): boolean {
  const { clientKey, clientSecret } = getTikTokAppCredentials();
  return Boolean(clientKey && clientSecret);
}

/** For 503 responses — which env vars are missing for the active mode. */
export function tikTokMissingSecretFlags(): Record<string, boolean> {
  const mode = resolveTikTokCredentialsMode();
  if (mode === "sandbox") {
    return {
      TIKTOK_CREDENTIALS_MODE: false,
      TIKTOK_SANDBOX_CLIENT_KEY:
        !secretTrim("TIKTOK_SANDBOX_CLIENT_KEY") && !secretTrim("TIKTOK_SANDBOX_CLIENT_ID"),
      TIKTOK_SANDBOX_CLIENT_SECRET: !secretTrim("TIKTOK_SANDBOX_CLIENT_SECRET"),
    };
  }
  return {
    TIKTOK_CREDENTIALS_MODE: false,
    TIKTOK_CLIENT_KEY: !secretTrim("TIKTOK_CLIENT_KEY") && !secretTrim("TIKTOK_CLIENT_ID"),
    TIKTOK_CLIENT_SECRET: !secretTrim("TIKTOK_CLIENT_SECRET"),
  };
}
