/** One-time credit top-ups (Stripe Checkout `mode: payment`). */

export type CreditPackId = "boost_100" | "boost_300" | "boost_800" | "boost_2000";

export type CreditPackEntry = {
  id: CreditPackId;
  name: string;
  credits: number;
  priceUsd: number;
  tagline: string;
};

export const CREDIT_PACKS: CreditPackEntry[] = [
  { id: "boost_100", name: "Boost", credits: 100, priceUsd: 5, tagline: "A few cover runs or content batches" },
  { id: "boost_300", name: "Plus", credits: 300, priceUsd: 12, tagline: "Best for a single release push" },
  { id: "boost_800", name: "Vault", credits: 800, priceUsd: 28, tagline: "Heavy cover + Suno week" },
  { id: "boost_2000", name: "Max", credits: 2000, priceUsd: 60, tagline: "One-time studio sprint" },
];

const BY_ID = Object.fromEntries(CREDIT_PACKS.map((p) => [p.id, p])) as Record<CreditPackId, CreditPackEntry>;

export function normalizeCreditPackId(raw: unknown): CreditPackId | null {
  const id = String(raw || "").trim().toLowerCase();
  if (id in BY_ID) return id as CreditPackId;
  return null;
}

export function creditsForPack(packId: CreditPackId): number {
  const entry = BY_ID[packId];
  const envKey = `CREDIT_PACK_${packId.toUpperCase().replace("BOOST_", "")}_CREDITS`;
  const raw = Deno.env.get(envKey);
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return entry?.credits ?? 0;
}

export function resolveCreditPackPriceId(packId: CreditPackId): string {
  const key = `STRIPE_CREDIT_PACK_${packId.toUpperCase()}_PRICE_ID`;
  return (Deno.env.get(key) || "").trim();
}

export function creditPackFromStripePriceId(priceId: string): CreditPackId | null {
  const id = priceId.trim();
  if (!id) return null;
  for (const pack of CREDIT_PACKS) {
    if (resolveCreditPackPriceId(pack.id) === id) return pack.id;
  }
  return null;
}

export function creditPacksConfigured(): boolean {
  if (!(Deno.env.get("STRIPE_SECRET_KEY") || "").trim()) return false;
  return CREDIT_PACKS.some((p) => resolveCreditPackPriceId(p.id));
}

export function publicCreditPackCatalog() {
  return CREDIT_PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    credits: creditsForPack(p.id),
    priceUsd: p.priceUsd,
    pricePerCreditUsd: Number((p.priceUsd / creditsForPack(p.id)).toFixed(3)),
    priceConfigured: Boolean(resolveCreditPackPriceId(p.id)),
  }));
}
