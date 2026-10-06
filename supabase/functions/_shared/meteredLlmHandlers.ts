import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { withCreditCharge, withMeteredCreditCharge, type CreditAction } from "./billing.ts";
import {
  estimateLlmCreditHold,
  resolveMeteredLlmCredits,
  stripMeteredResponseFields,
  usageBasedCreditsEnabled,
} from "./usageCredits.ts";

export async function chargeForLlmJson<T extends Record<string, unknown>>(
  admin: SupabaseClient,
  userId: string,
  action: CreditAction,
  prompt: string,
  work: () => Promise<T>
): Promise<{ result: T; balanceAfter: number; creditsCharged: number }> {
  const promptChars = String(prompt || "").length;

  if (!usageBasedCreditsEnabled()) {
    const { result, spend } = await withCreditCharge(admin, userId, action, {}, work);
    const cleaned = stripMeteredResponseFields(result) as T;
    return { result: cleaned, balanceAfter: spend.balanceAfter, creditsCharged: spend.cost };
  }

  const hold = estimateLlmCreditHold(promptChars);
  const { result, spend } = await withMeteredCreditCharge(
    admin,
    userId,
    action,
    { promptChars },
    hold,
    async () => {
      const raw = await work();
      const creditCost = resolveMeteredLlmCredits(raw, promptChars);
      return {
        result: raw,
        creditCost,
        usageDetail: { promptChars, metered: true },
      };
    }
  );
  const cleaned = stripMeteredResponseFields(result) as T;
  return { result: cleaned, balanceAfter: spend.balanceAfter, creditsCharged: spend.cost };
}
