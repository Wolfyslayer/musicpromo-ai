import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { startSubscriptionCheckout } from "@/services/billingService";

export default function SubscriptionPlanPicker({ catalog, currentPlan, stripeConfigured, onCheckoutStart }) {
  const [interval, setInterval] = useState("month");
  const [busyPlan, setBusyPlan] = useState("");

  const subscribe = async (planId) => {
    setBusyPlan(planId);
    try {
      onCheckoutStart?.();
      await startSubscriptionCheckout(planId, interval);
    } catch (e) {
      onCheckoutStart?.(e);
      setBusyPlan("");
    }
  };

  if (!stripeConfigured) {
    return (
      <p className="text-sm text-muted-foreground">
        Paid plans need Stripe price IDs in Supabase (see docs/BILLING.md). Display prices below are targets for your
        Stripe products.
      </p>
    );
  }

  const plans = catalog?.length ? catalog : [];

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full bg-muted/50 p-1">
        <button
          type="button"
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition",
            interval === "month" ? "bg-background shadow-sm" : "text-muted-foreground"
          )}
          onClick={() => setInterval("month")}
        >
          Monthly
        </button>
        <button
          type="button"
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition",
            interval === "year" ? "bg-background shadow-sm" : "text-muted-foreground"
          )}
          onClick={() => setInterval("year")}
        >
          Yearly
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = currentPlan === p.id;
          const price = interval === "year" ? p.priceYearlyUsd : p.priceMonthlyUsd;
          const priceConfigured = p.pricesConfigured?.[interval];
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
              <p className="mt-3 text-2xl font-bold tabular-nums">
                ${price}
                <span className="text-sm font-normal text-muted-foreground">/{interval === "year" ? "yr" : "mo"}</span>
              </p>
              {interval === "year" && p.yearlySavingsUsd > 0 ? (
                <p className="text-xs text-emerald-500">Save ${p.yearlySavingsUsd}/yr vs monthly</p>
              ) : null}
              <ul className="mt-3 flex-1 space-y-1.5 text-xs text-muted-foreground">
                {p.highlights?.map((h) => (
                  <li key={h}>• {h}</li>
                ))}
              </ul>
              <Button
                type="button"
                className="mt-4 w-full rounded-full"
                variant={p.id === "creator" ? "default" : "outline"}
                disabled={isCurrent || busyPlan === p.id || !priceConfigured}
                onClick={() => subscribe(p.id)}
              >
                {busyPlan === p.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isCurrent ? "Current plan" : priceConfigured ? "Subscribe" : "Price not configured"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
