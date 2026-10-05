/** Stem separation — TemPolor Open Platform (default) or Replicate Demucs fallback. */

import { normalizeApiKey } from "./externalUrl.ts";
import {
  isTempolorConfigured,
  readTempolorConfig,
  tempolorCallbackUrl,
  tempolorRequest,
  TEMPOLOR_POLL_MS,
  TEMPOLOR_POLL_TIMEOUT_MS,
} from "./tempolorApi.ts";

const DEFAULT_REPLICATE_MODEL =
  "cjwbw/demucs:6716f1a542e14b634e3c20c006b1b685173fb2d285088a5e794436a440a0a6f3";
const DEFAULT_TEMPOLOR_STEM_MODEL = "Stems v2";

function replicateToken(): string {
  return normalizeApiKey(Deno.env.get("REPLICATE_API_TOKEN") || "");
}

function mapReplicateError(message: unknown, status?: number): string {
  const m = String(message || "").trim();
  if (!m && status === 401) {
    return "Replicate rejected the API token. Add REPLICATE_API_TOKEN or use TemPolor (SUNO_API_KEY + PUBLIC_APP_URL).";
  }
  if (/valid authentication token|unauthenticated|401/i.test(m) || status === 401) {
    return "Replicate rejected the API token. Set REPLICATE_API_TOKEN or configure TemPolor (SUNO_API_KEY + PUBLIC_APP_URL).";
  }
  return m || `Replicate error (${status ?? "unknown"})`;
}

async function replicateFetch(path: string, init: RequestInit = {}) {
  const token = replicateToken();
  if (!token) throw new Error("Stem splitter needs REPLICATE_API_TOKEN or TemPolor (SUNO_API_KEY + PUBLIC_APP_URL).");
  const res = await fetch(`https://api.replicate.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.detail ?? data?.error ?? data?.title;
    throw new Error(mapReplicateError(detail, res.status));
  }
  return data;
}

export function stemSplitProviderStatus() {
  const tempolor = isTempolorConfigured();
  const replicate = Boolean(replicateToken());
  const configured = tempolor || replicate;
  return {
    configured,
    provider: tempolor ? "tempolor" : replicate ? "replicate" : "off",
    model: tempolor
      ? (Deno.env.get("SUNO_API_STEM_MODEL") || DEFAULT_TEMPOLOR_STEM_MODEL).trim()
      : Deno.env.get("REPLICATE_STEM_MODEL") || DEFAULT_REPLICATE_MODEL,
    note: tempolor
      ? "Stem separation uses TemPolor (same SUNO_API_KEY + PUBLIC_APP_URL as AI songs)."
      : replicate
        ? "Splits audio via Replicate Demucs (REPLICATE_API_TOKEN)."
        : "Set SUNO_API_KEY + PUBLIC_APP_URL for TemPolor stems, or REPLICATE_API_TOKEN for Replicate.",
  };
}

async function pollTempolorStems(base: string, key: string, itemId: string): Promise<string> {
  const deadline = Date.now() + TEMPOLOR_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const data = await tempolorRequest<{
      data?: { stems?: Record<string, unknown>[] };
    }>(base, key, "/open-apis/v1/stems/query", { item_ids: [itemId] });

    const stem = data?.data?.stems?.[0];
    if (!stem) {
      await new Promise((r) => setTimeout(r, TEMPOLOR_POLL_MS));
      continue;
    }

    const status = String(stem.status || "").toLowerCase();
    if (status === "failed") {
      throw new Error("TemPolor could not split this audio. Try a shorter clip or a direct MP3/WAV URL.");
    }

    const stemsUrl = String(stem.stems_url || "").trim();
    if (stemsUrl && status === "succeeded") {
      return stemsUrl;
    }

    await new Promise((r) => setTimeout(r, TEMPOLOR_POLL_MS));
  }
  throw new Error("Stem split timed out — TemPolor may still be processing. Try again shortly.");
}

async function splitViaTempolor(audioUrl: string): Promise<{
  stems: Record<string, string>;
  provider: string;
}> {
  const cfg = readTempolorConfig();
  if (!isTempolorConfigured(cfg)) {
    throw new Error("TemPolor is not configured (SUNO_API_KEY + PUBLIC_APP_URL).");
  }
  const { key, base, publicApp } = cfg;

  const url = String(audioUrl || "").trim();
  if (!url) throw new Error("Audio URL is required.");
  const model = (Deno.env.get("SUNO_API_STEM_MODEL") || DEFAULT_TEMPOLOR_STEM_MODEL).trim();

  const started = await tempolorRequest<{ data?: { item_ids?: string[] } }>(
    base,
    key,
    "/open-apis/v1/stems",
    {
      url,
      callback_url: tempolorCallbackUrl(publicApp),
      ...(model ? { model } : {}),
    }
  );

  const itemId = started?.data?.item_ids?.[0];
  if (!itemId) {
    throw new Error("TemPolor did not return item_ids. Check API credits and that the audio URL is public (≤50MB).");
  }

  const stemsUrl = await pollTempolorStems(base, key, String(itemId));
  return {
    stems: { stems_zip: stemsUrl },
    provider: "tempolor",
  };
}

async function splitViaReplicate(audioUrl: string): Promise<{
  stems: Record<string, string>;
  provider: string;
}> {
  const slug = (Deno.env.get("REPLICATE_STEM_MODEL") || DEFAULT_REPLICATE_MODEL).trim();
  const prediction = await replicateFetch(`/models/${slug}/predictions`, {
    method: "POST",
    body: JSON.stringify({
      input: { audio: audioUrl },
    }),
  });

  const deadline = Date.now() + TEMPOLOR_POLL_TIMEOUT_MS;
  let done = prediction;
  while (done.status !== "succeeded" && done.status !== "failed" && done.status !== "canceled") {
    if (Date.now() > deadline) throw new Error("Stem split timed out.");
    await new Promise((r) => setTimeout(r, 2500));
    done = await replicateFetch(`/predictions/${prediction.id}`);
  }
  if (done.status !== "succeeded") {
    throw new Error(String(done.error || "Stem split failed."));
  }

  const out = done.output;
  const stems: Record<string, string> = {};
  if (out && typeof out === "object" && !Array.isArray(out)) {
    for (const [k, v] of Object.entries(out as Record<string, unknown>)) {
      if (typeof v === "string") stems[k] = v;
    }
  } else if (Array.isArray(out)) {
    out.forEach((itemUrl, i) => {
      if (typeof itemUrl === "string") stems[`stem_${i + 1}`] = itemUrl;
    });
  }

  if (!Object.keys(stems).length) throw new Error("No stem URLs returned.");
  return { stems, provider: "replicate" };
}

export async function splitAudioToStems(audioUrl: string): Promise<{
  stems: Record<string, string>;
  provider: string;
}> {
  if (isTempolorConfigured()) {
    return splitViaTempolor(audioUrl);
  }
  if (replicateToken()) {
    return splitViaReplicate(audioUrl);
  }
  throw new Error(
    "Stem splitter is not configured. Set SUNO_API_KEY and PUBLIC_APP_URL for TemPolor, or REPLICATE_API_TOKEN for Replicate."
  );
}
