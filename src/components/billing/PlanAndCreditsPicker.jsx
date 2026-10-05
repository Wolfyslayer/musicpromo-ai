import { useState } from "react";
import { Check, Loader2, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { startCreditPackCheckout, startSubscriptionCheckout } from "@/services/billingService";

const PLAN_COLUMNS = [
  { id: "free", label: "Free" },
  { id: "creator", label: "Creator" },
  { id: "pro", label: "Pro" },
  { id: "studio", label: "Studio" },
];

function CellValue({ value }) {
  if (value === true) {
    return <Check className="mx-auto h-4 w-4 text-emerald-500" aria-label="Included" />;
  }
  if (value === false) {
    return <X className="mx-auto h-4 w-4 text-muted-foreground/50" aria-label="Not included" />;
  }
  if (value == null || value === "") {
    return <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-hidden />;
  }
  return <span className="text-xs font-medium tabular-nums">{value}</span>;
}

export default function PlanAndCreditsPicker({
  catalog,
  planComparison,
  creditPackCatalog,
  stripeConfigured,
  creditPacksConfigured,
  stripeEmbeddedCheckout,
  currentPlan,
  onCheckoutStart,
  onCheckoutSession,
}) {
  const [busyKey, setBusyKey] = useState("");

  const openEmbedded = async (promise, key) => {
    setBusyKey(key);
    try {
      const session = await promise;
      if (session?.billingExempt) {
        onCheckoutStart?.(new Error(session.message || "Billing not required for this account."));
        return;
      }
      onCheckoutSession?.(session);
    } catch (e) {
      onCheckoutStart?.(e);
    } finally {
      setBusyKey("");
    }
  };

  const subscribe = (planId, interval) => openEmbedded(startSubscriptionCheckout(planId, interval), `${planId}-${interval}`);

  const buyPack = (packId) => openEmbedded(startCreditPackCheckout(packId), `pack-${packId}`);

  if (!stripeConfigured && !creditPacksConfigured) {
    return (
      <p className="text-sm text-muted-foreground">
        Paid plans and credit packs need Stripe price IDs in Supabase (see docs/BILLING.md). Display prices below are
        targets for your Stripe products.
      </p>
    );
  }

  if (!stripeEmbeddedCheckout) {
    return (
      <p className="text-sm text-muted-foreground">
        Add <code className="text-xs">STRIPE_PUBLISHABLE_KEY</code> (pk_test_… or pk_live_…) to Supabase Edge Function
        secrets so checkout can open in-app. See docs/BILLING.md.
      </p>
    );
  }

  const plans = catalog?.length ? catalog : [];
  const comparison = planComparison?.length ? planComparison : [];
  const packs = creditPackCatalog?.length ? creditPackCatalog : [];
  const paidCurrent = currentPlan && currentPlan !== "free" ? currentPlan : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Subscriptions include Suno-style songs, stem splitting, and a monthly credit pool. Campaign plans and cloud video
        clips stay free on every tier. One-time credit packs add to your balance immediately after checkout.
      </p>

      <Tabs defaultValue="plans" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap gap-1 p-1">
          <TabsTrigger value="plans" className="flex-1 min-w-[5.5rem]">
            Plans
          </TabsTrigger>
          <TabsTrigger value="compare" className="flex-1 min-w-[5.5rem]">
            Compare
          </TabsTrigger>
          <TabsTrigger value="credits" className="flex-1 min-w-[5.5rem]">
            Credit packs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
            <p className="font-medium">Free</p>
            <p className="mt-0.5 text-muted-foreground">
              Monthly credits, daily 🎁 streak, free campaign plans & cloud video — no card required.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {plans.map((p) => {
              const isCurrent = paidCurrent === p.id;
              const monthOk = p.pricesConfigured?.month;
              const yearOk = p.pricesConfigured?.year;
              const busyMonth = busyKey === `${p.id}-month`;
              const busyYear = busyKey === `${p.id}-year`;

              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex flex-col rounded-2xl border p-4",
                    p.id === "creator" ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card/50"
                  )}
                >
                  <p className="font-heading text-lg font-semibold">{p.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>

                  <div className="mt-4 space-y-3 rounded-xl border border-border/50 bg-background/60 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Monthly
                        </p>
                        <p className="text-xl font-bold tabular-nums">
                          ${p.priceMonthlyUsd}
                          <span className="text-sm font-normal text-muted-foreground">/mo</span>
                        </p>
                      </div>
                      {p.compareAtMonthlyUsd > p.priceMonthlyUsd ? (
                        <p className="text-xs text-muted-foreground line-through tabular-nums">
                          ~${p.compareAtMonthlyUsd}/mo elsewhere
                        </p>
                      ) : null}
                    </div>
                    {p.savingsVsTypicalMonthlyUsd > 0 ? (
                      <p className="text-xs text-emerald-500">
                        About ${p.savingsVsTypicalMonthlyUsd}/mo less than typical AI music stacks
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      className="w-full rounded-full"
                      variant={p.id === "creator" ? "default" : "outline"}
                      size="sm"
                      disabled={isCurrent || busyMonth || busyYear || !monthOk || !stripeConfigured}
                      onClick={() => subscribe(p.id, "month")}
                    >
                      {busyMonth ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {isCurrent ? "Current plan" : monthOk ? "Subscribe monthly" : "Monthly price not set"}
                    </Button>

                    <div className="border-t border-border/40 pt-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Yearly
                          </p>
                          <p className="text-xl font-bold tabular-nums">
                            ${p.priceYearlyUsd}
                            <span className="text-sm font-normal text-muted-foreground">/yr</span>
                          </p>
                        </div>
                        {p.yearlySavingsUsd > 0 ? (
                          <p className="text-xs text-emerald-500">Save ${p.yearlySavingsUsd}/yr vs monthly</p>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        ≈ ${(p.priceYearlyUsd / 12).toFixed(2)}/mo billed once per year
                      </p>
                      <Button
                        type="button"
                        className="mt-2 w-full rounded-full"
                        variant="outline"
                        size="sm"
                        disabled={isCurrent || busyMonth || busyYear || !yearOk || !stripeConfigured}
                        onClick={() => subscribe(p.id, "year")}
                      >
                        {busyYear ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {yearOk ? "Subscribe yearly" : "Yearly price not set"}
                      </Button>
                    </div>
                  </div>

                  <ul className="mt-3 flex-1 space-y-1.5 text-xs text-muted-foreground">
                    {p.highlights?.map((h) => (
                      <li key={h}>• {h}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="compare">
          {comparison.length ? (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="p-3 font-medium text-muted-foreground">What you get</th>
                    {PLAN_COLUMNS.map((col) => (
                      <th key={col.id} className="p-3 text-center font-semibold">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.key} className="border-b border-border/40 last:border-0">
                      <td className="p-3 text-muted-foreground">{row.label}</td>
                      {PLAN_COLUMNS.map((col) => (
                        <td key={col.id} className="p-3 text-center">
                          <CellValue value={row[col.id]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Comparison will load once billing is configured.</p>
          )}
        </TabsContent>

        <TabsContent value="credits" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            One-time purchases add credits to your current balance. They do not change your subscription tier and never
            expire within your account.
          </p>
          {!creditPacksConfigured ? (
            <p className="text-sm text-amber-600 dark:text-amber-500">
              Credit pack checkout is not configured yet. Add STRIPE_CREDIT_PACK_*_PRICE_ID secrets (see docs/BILLING.md).
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {packs.map((pack) => {
              const busy = busyKey === `pack-${pack.id}`;
              return (
                <div
                  key={pack.id}
                  className="flex flex-col rounded-2xl border border-border/60 bg-card/50 p-4"
                >
                  <p className="font-heading font-semibold">{pack.name}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {pack.credits}
                    <span className="text-sm font-normal text-muted-foreground"> credits</span>
                  </p>
                  <p className="mt-2 text-lg font-semibold tabular-nums">${pack.priceUsd}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    ${pack.pricePerCreditUsd}/credit
                  </p>
                  <p className="mt-2 flex-1 text-xs text-muted-foreground">{pack.tagline}</p>
                  <Button
                    type="button"
                    className="mt-4 w-full rounded-full"
                    variant="outline"
                    size="sm"
                    disabled={busy || !pack.priceConfigured || !creditPacksConfigured}
                    onClick={() => buyPack(pack.id)}
                  >
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {pack.priceConfigured ? "Buy once" : "Price not configured"}
                  </Button>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
