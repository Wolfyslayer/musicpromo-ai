import { secrets } from "./runtime.ts";

export type KickCampaignWorkerOptions = {
  skipVideo?: boolean;
  skipStats?: boolean;
  batchLimit?: number;
  skipPublish?: boolean;
};

/** Fire-and-forget nudge so due scheduled SocialPosts publish without waiting for cron. */
export function kickCampaignWorkerAsync(options: KickCampaignWorkerOptions = {}): void {
  const baseUrl = String(secrets.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = String(secrets.get("SUPABASE_SERVICE_ROLE_KEY") || "");
  if (!baseUrl || !serviceKey) {
    console.warn("[kickCampaignWorker] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  const body = JSON.stringify({
    skipVideo: options.skipVideo !== false,
    skipStats: options.skipStats !== false,
    batchLimit: options.batchLimit ?? 12,
    skipPublish: options.skipPublish === true,
  });

  const task = fetch(`${baseUrl}/functions/v1/campaignWorker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body,
  }).catch((err) => {
    console.warn("[kickCampaignWorker]", (err as Error)?.message || err);
  });

  const edge = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (edge?.waitUntil) {
    edge.waitUntil(task);
  }
}

/** Await worker kick (for dedicated kick endpoint). */
export async function kickCampaignWorkerSync(
  options: KickCampaignWorkerOptions = {}
): Promise<Response | null> {
  const baseUrl = String(secrets.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = String(secrets.get("SUPABASE_SERVICE_ROLE_KEY") || "");
  if (!baseUrl || !serviceKey) return null;

  return fetch(`${baseUrl}/functions/v1/campaignWorker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      skipVideo: options.skipVideo !== false,
      skipStats: options.skipStats !== false,
      batchLimit: options.batchLimit ?? 12,
      skipPublish: options.skipPublish === true,
    }),
  });
}
