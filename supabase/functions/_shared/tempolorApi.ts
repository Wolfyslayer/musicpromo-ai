/**
 * TemPolor Open Platform — shared HTTP client (song + stems).
 * Secrets: SUNO_API_KEY, SUNO_API_BASE_URL, PUBLIC_APP_URL, optional SUNO_API_LEGACY.
 */

import { normalizeApiKey, normalizeExternalBaseUrl } from "./externalUrl.ts";

export const TEMPOLOR_DEFAULT_BASE = "https://api.tempolor.com";
export const TEMPOLOR_SUCCESS = 200000;
export const TEMPOLOR_POLL_MS = 4000;
export const TEMPOLOR_POLL_TIMEOUT_MS = 240_000;

export type TempolorConfig = {
  key: string;
  base: string;
  publicApp: string;
  legacy: boolean;
};

export function readTempolorConfig(): TempolorConfig {
  const key = normalizeApiKey(Deno.env.get("SUNO_API_KEY") || "");
  const base = normalizeExternalBaseUrl(
    Deno.env.get("SUNO_API_BASE_URL") || "",
    TEMPOLOR_DEFAULT_BASE
  );
  const publicAppRaw = Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("APP_PUBLIC_URL") || "";
  const publicApp = publicAppRaw ? normalizeExternalBaseUrl(publicAppRaw) : "";
  const legacy = Deno.env.get("SUNO_API_LEGACY") === "true";
  return { key, base, publicApp, legacy };
}

export function isTempolorPlatform(base: string, legacy: boolean): boolean {
  if (legacy) return false;
  const b = base.toLowerCase();
  return (
    b.includes("tempolor.com") ||
    b.includes("tianpuyue.cn") ||
    base === TEMPOLOR_DEFAULT_BASE
  );
}

/** TemPolor song + stem tasks both need callback_url and the same SUNO_API_* secrets. */
export function isTempolorConfigured(cfg: TempolorConfig = readTempolorConfig()): boolean {
  return Boolean(
    cfg.key && cfg.publicApp && isTempolorPlatform(cfg.base, cfg.legacy)
  );
}

export function mapTempolorError(message: string, status?: number): string {
  const m = String(message || "").trim();
  if (/valid authentication token|unauthorized|invalid.*key|401/i.test(m) || status === 401) {
    return (
      "TemPolor rejected the API key. Set SUNO_API_KEY to your TemPolor platform key (Authorization header value, not Bearer) from platform.tempolor.com."
    );
  }
  if (/Invalid URL/i.test(m)) {
    return (
      "TemPolor API URL is invalid. Set SUNO_API_BASE_URL to https://api.tempolor.com (include https://)."
    );
  }
  return m || "TemPolor API request failed.";
}

export function tempolorCallbackUrl(
  publicApp: string,
  functionName = "tempolorSongCallback"
): string {
  if (!publicApp) {
    throw new Error(
      "PUBLIC_APP_URL is required for TemPolor (callback_url). Add it to Supabase / Base44 secrets."
    );
  }
  return `${publicApp}/functions/v1/${functionName}`;
}

export async function tempolorRequest<T = Record<string, unknown>>(
  base: string,
  key: string,
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        Authorization: key,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg = (err as Error).message || String(err);
    throw new Error(mapTempolorError(msg));
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      mapTempolorError(String(data?.message || data?.error || `TemPolor API HTTP ${res.status}`), res.status)
    );
  }
  const status = Number(data?.status);
  if (status && status !== TEMPOLOR_SUCCESS) {
    throw new Error(mapTempolorError(String(data?.message || `TemPolor API error (${status})`)));
  }
  return data as T;
}
