import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { isBillingExempt } from "./appRoles.ts";
import { ensureUserBilling } from "./billing.ts";
import { type BillingPlanId, type PremiumFeature, planHasPremiumFeature } from "./subscriptionPlans.ts";

export class PremiumFeatureRequiredError extends Error {
  code = "PREMIUM_REQUIRED";
  status = 403;
  constructor(
    public feature: PremiumFeature,
    public plan: BillingPlanId
  ) {
    super(
      `This feature requires a Creator plan or higher. Upgrade in Settings → Plan & credits (from $9/mo).`
    );
    this.name = "PremiumFeatureRequiredError";
  }
}

function isSubscriptionActive(row: {
  plan?: string;
  subscription_status?: string | null;
  subscription_current_period_end?: string | null;
}): boolean {
  const plan = String(row.plan || "free");
  if (plan === "free") return false;
  const st = String(row.subscription_status || "").toLowerCase();
  if (st === "active" || st === "trialing") return true;
  const end = row.subscription_current_period_end ? Date.parse(String(row.subscription_current_period_end)) : 0;
  return end > Date.now();
}

export async function resolveBillingPlanId(admin: SupabaseClient, userId: string): Promise<BillingPlanId> {
  if (await isBillingExempt(admin, userId)) return "studio";
  await ensureUserBilling(admin, userId);
  const { data: row } = await admin
    .from("user_billing")
    .select("plan, subscription_status, subscription_current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row || !isSubscriptionActive(row)) return "free";
  const plan = String(row.plan || "free").toLowerCase();
  if (plan === "creator" || plan === "pro" || plan === "studio") return plan;
  return "free";
}

export async function assertPremiumFeature(
  admin: SupabaseClient,
  userId: string,
  feature: PremiumFeature
): Promise<BillingPlanId> {
  if (await isBillingExempt(admin, userId)) return "studio";
  const plan = await resolveBillingPlanId(admin, userId);
  if (!planHasPremiumFeature(plan, feature)) {
    throw new PremiumFeatureRequiredError(feature, plan);
  }
  return plan;
}

export function premiumErrorResponse(err: unknown): { status: number; body: Record<string, unknown> } | null {
  if (err instanceof PremiumFeatureRequiredError) {
    return {
      status: err.status,
      body: { error: err.message, code: err.code, feature: err.feature, plan: err.plan },
    };
  }
  return null;
}
