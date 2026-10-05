import { handleCampaignWorkerRequest } from "./campaignWorkerHandler.ts";

export type KickCampaignWorkerOptions = {
  skipVideo?: boolean;
  skipStats?: boolean;
  batchLimit?: number;
  skipPublish?: boolean;
};

function buildWorkerRequest(options: KickCampaignWorkerOptions): Request {
  return new Request("https://internal/campaignWorker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      skipVideo: options.skipVideo !== false,
      skipStats: options.skipStats !== false,
      batchLimit: options.batchLimit ?? 12,
      skipPublish: options.skipPublish === true,
    }),
  });
}

/** Run publish worker in-process (no HTTP self-call). */
export function kickCampaignWorkerAsync(options: KickCampaignWorkerOptions = {}): void {
  const task = handleCampaignWorkerRequest(buildWorkerRequest(options)).catch((err) => {
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
  try {
    return await handleCampaignWorkerRequest(buildWorkerRequest(options));
  } catch (err) {
    console.warn("[kickCampaignWorker]", (err as Error)?.message || err);
    return null;
  }
}
