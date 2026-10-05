/** Vocal / drum / bass / other stems via Replicate (Demucs-class models). */

import { normalizeApiKey } from "./externalUrl.ts";

const DEFAULT_MODEL = "cjwbw/demucs:6716f1a542e14b634e3c20c006b1b685173fb2d285088a5e794436a440a0a6f3";

function replicateToken(): string {
  return normalizeApiKey(Deno.env.get("REPLICATE_API_TOKEN") || "");
}

function mapReplicateError(message: unknown, status?: number): string {
  const m = String(message || "").trim();
  if (!m && status === 401) {
    return "Replicate rejected the API token. Add REPLICATE_API_TOKEN (r8_… from replicate.com/account/api-tokens) to Supabase secrets and redeploy splitAudioStems.";
  }
  if (/valid authentication token|unauthenticated|401/i.test(m) || status === 401) {
    return "Replicate rejected the API token. Set REPLICATE_API_TOKEN in Supabase secrets (r8_… from replicate.com/account/api-tokens) and redeploy splitAudioStems.";
  }
  return m || `Replicate error (${status ?? "unknown"})`;
}

async function replicateFetch(path: string, init: RequestInit = {}) {
  const token = replicateToken();
  if (!token) throw new Error("Stem splitter needs REPLICATE_API_TOKEN in Supabase secrets.");
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
  const configured = Boolean(replicateToken());
  return {
    configured,
    provider: configured ? "replicate" : "off",
    model: Deno.env.get("REPLICATE_STEM_MODEL") || DEFAULT_MODEL,
    note: configured
      ? "Splits uploaded audio into stems (Replicate — usage billed to your Replicate account)."
      : "Add REPLICATE_API_TOKEN to enable stem splitting for Creator+ subscribers.",
  };
}

export async function splitAudioToStems(audioUrl: string): Promise<{
  stems: Record<string, string>;
  provider: string;
}> {
  const slug = (Deno.env.get("REPLICATE_STEM_MODEL") || DEFAULT_MODEL).trim();
  const prediction = await replicateFetch(`/models/${slug}/predictions`, {
    method: "POST",
    body: JSON.stringify({
      input: { audio: audioUrl },
    }),
  });

  const deadline = Date.now() + 240_000;
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
    out.forEach((url, i) => {
      if (typeof url === "string") stems[`stem_${i + 1}`] = url;
    });
  }

  if (!Object.keys(stems).length) throw new Error("No stem URLs returned.");
  return { stems, provider: "replicate" };
}
