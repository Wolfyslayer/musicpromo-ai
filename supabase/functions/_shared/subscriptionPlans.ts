/** Paid tiers + catalog exposed to the app (prices are display hints — Stripe Price IDs are source of truth). */

export type PaidPlanId = "creator" | "pro" | "studio";
export type BillingPlanId = "free" | PaidPlanId;

export type PremiumFeature = "suno_generation" | "stem_split";

export type BillingInterval = "month" | "year";

export type PlanCatalogEntry = {
  id: PaidPlanId;
  name: string;
  tagline: string;
  /** USD list price for marketing UI */
  priceMonthlyUsd: number;
  priceYearlyUsd: number;
  monthlyCredits: number;
  premiumFeatures: PremiumFeature[];
  highlights: string[];
};

export const PAID_PLANS: PlanCatalogEntry[] = [
  {
    id: "creator",
    name: "Creator",
    tagline: "Suno-style songs + stems for indie releases",
    priceMonthlyUsd: 15,
    priceYearlyUsd: 144,
    monthlyCredits: 450,
    premiumFeatures: ["suno_generation", "stem_split"],
    highlights: [
      "450 AI credits / month",
      "AI song generation (Suno)",
      "Stem splitter (vocals / drums / bass / other)",
      "Campaign plans & video clips included",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "More credits for weekly content + covers",
    priceMonthlyUsd: 29,
    priceYearlyUsd: 278,
    monthlyCredits: 1200,
    premiumFeatures: ["suno_generation", "stem_split"],
    highlights: [
      "1,200 AI credits / month",
      "Everything in Creator",
      "Best for multiple releases / month",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "Label-style volume — compete with full AI suites",
    priceMonthlyUsd: 49,
    priceYearlyUsd: 470,
    monthlyCredits: 3500,
    premiumFeatures: ["suno_generation", "stem_split"],
    highlights: [
      "3,500 AI credits / month",
      "Everything in Pro",
      "Lowest cost per credit for power users",
    ],
  },
];

const PAID_BY_ID = Object.fromEntries(PAID_PLANS.map((p) => [p.id, p])) as Record<PaidPlanId, PlanCatalogEntry>;

export function normalizePaidPlanId(raw: unknown): PaidPlanId | null {
  const id = String(raw || "").trim().toLowerCase();
  if (id === "creator" || id === "pro" || id === "studio") return id;
  return null;
}

export function normalizeBillingInterval(raw: unknown): BillingInterval {
  return String(raw || "month").trim().toLowerCase() === "year" ? "year" : "month";
}

export function monthlyCreditsForPlan(plan: BillingPlanId): number {
  if (plan === "free") {
    const raw = Deno.env.get("BILLING_FREE_MONTHLY_CREDITS");
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return Math.floor(n);
    }
    return 120;
  }
  const entry = PAID_BY_ID[plan as PaidPlanId];
  if (!entry) return 120;
  const envKey = `BILLING_${plan.toUpperCase()}_MONTHLY_CREDITS`;
  const raw = Deno.env.get(envKey);
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return entry.monthlyCredits;
}

export function planHasPremiumFeature(plan: BillingPlanId, feature: PremiumFeature): boolean {
  if (plan === "free") return false;
  const entry = PAID_BY_ID[plan as PaidPlanId];
  return entry?.premiumFeatures.includes(feature) ?? false;
}

/** Map Stripe Price id → paid plan (configure in Supabase secrets). */
export function planFromStripePriceId(priceId: string): PaidPlanId | null {
  const id = priceId.trim();
  if (!id) return null;
  const pairs: [PaidPlanId, BillingInterval][] = [
    ["creator", "month"],
    ["creator", "year"],
    ["pro", "month"],
    ["pro", "year"],
    ["studio", "month"],
    ["studio", "year"],
  ];
  for (const [plan, interval] of pairs) {
    if (resolveStripePriceId(plan, interval) === id) return plan;
  }
  const legacy = (Deno.env.get("STRIPE_PRO_PRICE_ID") || "").trim();
  if (legacy && legacy === id) return "pro";
  return null;
}

export function resolveStripePriceId(plan: PaidPlanId, interval: BillingInterval): string {
  const key =
    interval === "year"
      ? `STRIPE_${plan.toUpperCase()}_YEARLY_PRICE_ID`
      : `STRIPE_${plan.toUpperCase()}_MONTHLY_PRICE_ID`;
  const fromEnv = (Deno.env.get(key) || "").trim();
  if (fromEnv) return fromEnv;
  if (plan === "pro" && interval === "month") {
    return (Deno.env.get("STRIPE_PRO_PRICE_ID") || "").trim();
  }
  return "";
}

export function stripePlansConfigured(): boolean {
  if (!(Deno.env.get("STRIPE_SECRET_KEY") || "").trim()) return false;
  return PAID_PLANS.some(
    (p) => resolveStripePriceId(p.id, "month") || resolveStripePriceId(p.id, "year")
  );
}

export function publicPlanCatalog() {
  return PAID_PLANS.map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    priceMonthlyUsd: p.priceMonthlyUsd,
    priceYearlyUsd: p.priceYearlyUsd,
    yearlySavingsUsd: Math.max(0, p.priceMonthlyUsd * 12 - p.priceYearlyUsd),
    monthlyCredits: monthlyCreditsForPlan(p.id),
    premiumFeatures: p.premiumFeatures,
    highlights: p.highlights,
    pricesConfigured: {
      month: Boolean(resolveStripePriceId(p.id, "month")),
      year: Boolean(resolveStripePriceId(p.id, "year")),
    },
  }));
}
