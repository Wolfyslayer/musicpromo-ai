import { createClientFromRequest } from "./runtime.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function findOAuthState(
  base44: ReturnType<typeof createClientFromRequest>,
  state: string
): Promise<Record<string, unknown> | null> {
  for (let i = 0; i < 5; i++) {
    try {
      const states = await base44.asServiceRole.entities.SocialOAuthState.filter(
        { state },
        "-created_date",
        5
      );
      if ((states || [])[0]) return states[0] as Record<string, unknown>;
    } catch (err) {
      console.warn("[socialOAuth] state_lookup", i, (err as Error)?.message || err);
    }
    await sleep(200 * (i + 1));
  }
  return null;
}
