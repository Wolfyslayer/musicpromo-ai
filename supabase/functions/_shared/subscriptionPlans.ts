/** Paid tiers + catalog exposed to the app (prices are display hints — Stripe Price IDs are source of truth). */

export type PaidPlanId = "creator" | "pro" | "studio";
export type BillingPlanId = "free" | PaidPlanId;

export type PremiumFeature = "suno_generation" | "stem_split";

export type BillingInterval = "month" | "year";

export type PlanCatalogEntry = {
  id: PaidPlanId;
  name: string;
  tagline: string;
  /** USD list price for marketing UI (set matching amounts in Stripe). */
  priceMonthlyUsd: number;
  priceYearlyUsd: number;
  /** Typical standalone AI music / promo apps (display-only comparison). */
  compareAtMonthlyUsd: number;
  monthlyCredits: number;
  premiumFeatures: PremiumFeature[];
  highlights: string[];
};

export const PAID_PLANS: PlanCatalogEntry[] = [
  {
    id: "creator",
    name: "Creator",
    tagline: "Songs + stems + promo — less than a Suno-style plan alone",
    priceMonthlyUsd: 9,
    priceYearlyUsd: 86,
    compareAtMonthlyUsd: 18,
    monthlyCredits: 500,
    premiumFeatures: ["suno_generation", "stem_split"],
    highlights: [
      "500 AI credits / month",
      "AI song generation (Suno)",
      "Stem splitter (vocals / drums / bass / other)",
      "Free campaign plans & video clips",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Weekly drops + cover art without the $30+ tool stack",
    priceMonthlyUsd: 18,
    priceYearlyUsd: 172,
    compareAtMonthlyUsd: 32,
    monthlyCredits: 1400,
    premiumFeatures: ["suno_generation", "stem_split"],
    highlights: [
      "1,400 AI credits / month",
      "Everything in Creator",
      "Built for artists posting every week",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "Roster volume — under typical label SaaS pricing",
    priceMonthlyUsd: 32,
    priceYearlyUsd: 306,
    compareAtMonthlyUsd: 55,
    monthlyCredits: 4000,
    premiumFeatures: ["suno_generation", "stem_split"],
    highlights: [
      "4,000 AI credits / month",
      "Everything in Pro",
      "Best $/credit for managers & small labels",
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

export type PlanComparisonRow = {
  key: string;
  label: string;
  free: string | boolean;
  creator: string | boolean;
  pro: string | boolean;
  studio: string | boolean;
};

/** Feature matrix for the plan picker "Compare" tab. */
export function publicPlanComparison(): PlanComparisonRow[] {
  const freeCredits = monthlyCreditsForPlan("free");
  return [
    {
      key: "monthly_credits",
      label: "Monthly AI credits",
      free: String(freeCredits),
      creator: String(monthlyCreditsForPlan("creator")),
      pro: String(monthlyCreditsForPlan("pro")),
      studio: String(monthlyCreditsForPlan("studio")),
    },
    {
      key: "campaign",
      label: "Campaign plan generation",
      free: true,
      creator: true,
      pro: true,
      studio: true,
    },
    {
      key: "video_clip",
      label: "Cloud AI video clips",
      free: true,
      creator: true,
      pro: true,
      studio: true,
    },
    {
      key: "suno",
      label: "AI song generation (Suno)",
      free: false,
      creator: true,
      pro: true,
      studio: true,
    },
    {
      key: "stems",
      label: "Stem splitter",
      free: false,
      creator: true,
      pro: true,
      studio: true,
    },
    {
      key: "daily_claim",
      label: "Daily 🎁 credit streak",
      free: true,
      creator: true,
      pro: true,
      studio: true,
    },
    {
      key: "credit_packs",
      label: "Buy extra credits anytime",
      free: true,
      creator: true,
      pro: true,
      studio: true,
    },
  ];
}

export function publicPlanCatalog() {
  return PAID_PLANS.map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    priceMonthlyUsd: p.priceMonthlyUsd,
    priceYearlyUsd: p.priceYearlyUsd,
    compareAtMonthlyUsd: p.compareAtMonthlyUsd,
    savingsVsTypicalMonthlyUsd: Math.max(0, p.compareAtMonthlyUsd - p.priceMonthlyUsd),
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
