import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { isBillingExempt, resolveAppRole, roleBypassesBilling } from "./appRoles.ts";
import { getDailyClaimStatus } from "./dailyClaims.ts";

export type BillingPlan = "free" | "pro";

export type CreditAction =
  | "analyze_song"
  | "generate_campaign"
  | "generate_content"
  | "cover_art"
  | "cover_art_edit"
  | "ai_video_clip";

/** Credits charged per premium AI call (tune via env CREDIT_COST_<ACTION>). */
export const CREDIT_COSTS: Record<CreditAction, number> = {
  analyze_song: 3,
  generate_campaign: 0,
  generate_content: 2,
  cover_art: 8,
  cover_art_edit: 10,
  ai_video_clip: 0,
};

/** Shown in API/docs — always free regardless of env overrides for these actions. */
export const ALWAYS_FREE_CREDIT_ACTIONS = new Set<CreditAction>(["generate_campaign", "ai_video_clip"]);

const PLAN_MONTHLY_GRANT: Record<BillingPlan, number> = {
  free: 120,
  pro: 1200,
};

export class InsufficientCreditsError extends Error {
  code = "INSUFFICIENT_CREDITS";
  status = 402;
  constructor(
    public balance: number,
    public required: number,
    public plan: BillingPlan
  ) {
    super(
      `Not enough credits (${balance} available, ${required} required). Upgrade to Pro in Settings → Plan & credits.`
    );
    this.name = "InsufficientCreditsError";
  }
}

function costForAction(action: CreditAction): number {
  if (ALWAYS_FREE_CREDIT_ACTIONS.has(action)) return 0;
  const envKey = `CREDIT_COST_${action.toUpperCase()}`;
  const raw = Deno.env.get(envKey);
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return CREDIT_COSTS[action];
}

export function publicCreditCosts(): Record<CreditAction, number> {
  const out = { ...CREDIT_COSTS };
  for (const action of ALWAYS_FREE_CREDIT_ACTIONS) {
    out[action] = 0;
  }
  return out;
}

function monthlyGrant(plan: BillingPlan): number {
  const key = plan === "pro" ? "BILLING_PRO_MONTHLY_CREDITS" : "BILLING_FREE_MONTHLY_CREDITS";
  const raw = Deno.env.get(key);
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return PLAN_MONTHLY_GRANT[plan];
}

function startOfUtcMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function isProActive(row: {
  plan?: string;
  subscription_status?: string | null;
  subscription_current_period_end?: string | null;
}): boolean {
  if (row.plan !== "pro") return false;
  const st = String(row.subscription_status || "").toLowerCase();
  if (st === "active" || st === "trialing") return true;
  const end = row.subscription_current_period_end ? Date.parse(String(row.subscription_current_period_end)) : 0;
  return end > Date.now();
}

export function effectivePlan(row: {
  plan?: string;
  subscription_status?: string | null;
  subscription_current_period_end?: string | null;
}): BillingPlan {
  return isProActive(row) ? "pro" : "free";
}

async function refreshPeriodCredits(
  admin: SupabaseClient,
  userId: string,
  row: {
    plan?: string;
    credits_balance?: number;
    credits_period_start?: string | null;
    subscription_status?: string | null;
    subscription_current_period_end?: string | null;
  }
): Promise<{ plan: BillingPlan; credits_balance: number; credits_period_start: string }> {
  const plan = effectivePlan(row);
  const periodStart = startOfUtcMonth();
  const storedStart = row.credits_period_start ? Date.parse(String(row.credits_period_start)) : 0;
  const needsRefresh = !storedStart || storedStart < periodStart.getTime();

  if (!needsRefresh) {
    return {
      plan,
      credits_balance: Number(row.credits_balance ?? 0),
      credits_period_start: String(row.credits_period_start),
    };
  }

  const grant = monthlyGrant(plan);
  const { error } = await admin.from("user_billing").upsert(
    {
      user_id: userId,
      plan,
      credits_balance: grant,
      credits_period_start: periodStart.toISOString(),
      claim_month_start: periodStart.toISOString(),
      claim_days_completed: 0,
      last_claim_utc_date: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);

  await admin.from("credit_ledger").insert({
    user_id: userId,
    delta: grant,
    balance_after: grant,
    action: "monthly_grant",
    metadata: { plan, period: periodStart.toISOString() },
  });

  return { plan, credits_balance: grant, credits_period_start: periodStart.toISOString() };
}

export async function ensureUserBilling(admin: SupabaseClient, userId: string) {
  const { data: row } = await admin.from("user_billing").select("*").eq("user_id", userId).maybeSingle();

  if (!row) {
    const grant = monthlyGrant("free");
    const periodStart = startOfUtcMonth().toISOString();
    const { error } = await admin.from("user_billing").insert({
      user_id: userId,
      plan: "free",
      credits_balance: grant,
      credits_period_start: periodStart,
    });
    if (error) throw new Error(error.message);
    await admin.from("credit_ledger").insert({
      user_id: userId,
      delta: grant,
      balance_after: grant,
      action: "signup_grant",
      metadata: { plan: "free" },
    });
    return refreshPeriodCredits(admin, userId, {
      plan: "free",
      credits_balance: grant,
      credits_period_start: periodStart,
    });
  }

  return refreshPeriodCredits(admin, userId, row);
}

export async function getBillingSnapshot(admin: SupabaseClient, userId: string) {
  const appRole = await resolveAppRole(admin, userId);
  const billingExempt = roleBypassesBilling(appRole);

  if (billingExempt) {
    return {
      plan: "pro" as BillingPlan,
      appRole,
      billingExempt: true,
      creditsBalance: null as number | null,
      creditsPeriodStart: null as string | null,
      monthlyGrant: null as number | null,
      subscriptionStatus: null,
      subscriptionRenewsAt: null,
      stripeConfigured: Boolean(Deno.env.get("STRIPE_SECRET_KEY") && Deno.env.get("STRIPE_PRO_PRICE_ID")),
      costs: publicCreditCosts(),
      freeFeatures: ["generate_campaign", "ai_video_clip"],
    };
  }

  const refreshed = await ensureUserBilling(admin, userId);
  const { data: row } = await admin
    .from("user_billing")
    .select(
      "plan, credits_balance, credits_period_start, subscription_status, subscription_current_period_end, stripe_customer_id"
    )
    .eq("user_id", userId)
    .maybeSingle();

  const plan = effectivePlan(row || {});
  return {
    plan,
    appRole,
    billingExempt: false,
    creditsBalance: refreshed.credits_balance,
    creditsPeriodStart: refreshed.credits_period_start,
    monthlyGrant: monthlyGrant(plan),
    subscriptionStatus: row?.subscription_status || null,
    subscriptionRenewsAt: row?.subscription_current_period_end || null,
    stripeConfigured: Boolean(Deno.env.get("STRIPE_SECRET_KEY") && Deno.env.get("STRIPE_PRO_PRICE_ID")),
    costs: publicCreditCosts(),
    freeFeatures: ["generate_campaign", "ai_video_clip"],
    dailyClaim: await getDailyClaimStatus(admin, userId),
  };
}

/** Deduct credits before an AI call. Refund manually if the call fails after deduct (optional). */
export async function spendCredits(
  admin: SupabaseClient,
  userId: string,
  action: CreditAction,
  metadata: Record<string, unknown> = {}
): Promise<{ cost: number; balanceAfter: number; plan: BillingPlan; billingExempt?: boolean }> {
  if (await isBillingExempt(admin, userId)) {
    return { cost: 0, balanceAfter: 0, plan: "pro", billingExempt: true };
  }

  const cost = costForAction(action);
  if (cost <= 0) {
    const snap = await ensureUserBilling(admin, userId);
    return { cost: 0, balanceAfter: snap.credits_balance, plan: snap.plan };
  }

  const snap = await ensureUserBilling(admin, userId);
  if (snap.credits_balance < cost) {
    throw new InsufficientCreditsError(snap.credits_balance, cost, snap.plan);
  }

  const balanceAfter = snap.credits_balance - cost;
  const { error: updErr } = await admin
    .from("user_billing")
    .update({ credits_balance: balanceAfter, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (updErr) throw new Error(updErr.message);

  await admin.from("credit_ledger").insert({
    user_id: userId,
    delta: -cost,
    balance_after: balanceAfter,
    action,
    metadata,
  });

  return { cost, balanceAfter, plan: snap.plan };
}

export async function refundCredits(
  admin: SupabaseClient,
  userId: string,
  amount: number,
  reason: string
) {
  if (amount <= 0) return;
  if (await isBillingExempt(admin, userId)) return;
  const snap = await ensureUserBilling(admin, userId);
  const balanceAfter = snap.credits_balance + amount;
  await admin
    .from("user_billing")
    .update({ credits_balance: balanceAfter, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  await admin.from("credit_ledger").insert({
    user_id: userId,
    delta: amount,
    balance_after: balanceAfter,
    action: "refund",
    metadata: { reason },
  });
}

export function billingErrorResponse(err: unknown): { status: number; body: Record<string, unknown> } | null {
  if (err instanceof InsufficientCreditsError) {
    return {
      status: err.status,
      body: {
        error: err.message,
        code: err.code,
        creditsBalance: err.balance,
        creditsRequired: err.required,
        plan: err.plan,
      },
    };
  }
  return null;
}
