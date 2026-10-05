import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  CREDIT_ACTION_LABELS,
  fetchBillingStatus,
  startProCheckout,
} from "@/services/billingService";

function Card({ title, children }) {
  return (
    <div className="surface space-y-4 rounded-2xl p-5">
      <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

export default function SettingsBillingPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [billing, setBilling] = useState(null);

  const load = () => {
    setLoading(true);
    fetchBillingStatus()
      .then(setBilling)
      .catch((e) => {
        setBilling(null);
        toast({ variant: "destructive", title: "Could not load billing", description: e.message });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast({ title: "Welcome to Pro", description: "Your subscription is processing. Credits refresh when Stripe confirms payment." });
      searchParams.delete("checkout");
      setSearchParams(searchParams, { replace: true });
      load();
    } else if (checkout === "cancel") {
      toast({ title: "Checkout canceled" });
      searchParams.delete("checkout");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  const costRows = useMemo(() => {
    const costs = billing?.costs || {};
    return Object.entries(costs)
      .filter(([, n]) => Number(n) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]));
  }, [billing?.costs]);

  const onUpgrade = async () => {
    setCheckoutBusy(true);
    try {
      await startProCheckout();
    } catch (e) {
      toast({ variant: "destructive", title: "Checkout unavailable", description: e.message });
      setCheckoutBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading plan & credits…
      </div>
    );
  }

  const exempt = Boolean(billing?.billingExempt);
  const roleLabel =
    billing?.appRole === "admin" ? "Admin" : billing?.appRole === "dev" ? "Developer" : null;
  const plan = exempt ? roleLabel || "Staff" : billing?.plan === "pro" ? "Pro" : "Free";
  const isPro = billing?.plan === "pro" || exempt;

  return (
    <div className="space-y-4">
      <Card title="Your plan">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5 text-primary" />
              {plan}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {exempt
                ? "Unlimited premium AI — credits are not deducted for this account."
                : isPro
                  ? "Higher monthly AI credits for campaigns, cover art, and optional cloud motion clips."
                  : "Includes a free monthly credit allowance. Upgrade for more AI generations each month."}
            </p>
            {billing?.subscriptionRenewsAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Renews {new Date(billing.subscriptionRenewsAt).toLocaleDateString()} · status{" "}
                {billing.subscriptionStatus || "active"}
              </p>
            ) : null}
          </div>
          {!exempt && !isPro && billing?.stripeConfigured ? (
            <Button type="button" className="rounded-full" disabled={checkoutBusy} onClick={onUpgrade}>
              {checkoutBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Upgrade to Pro
            </Button>
          ) : null}
        </div>
      </Card>

      <Card title="Credits this month">
        {exempt ? (
          <p className="text-lg font-semibold text-primary">Unlimited (staff)</p>
        ) : (
          <p className="text-3xl font-semibold tabular-nums">{billing?.creditsBalance ?? "—"}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {exempt
            ? "Assign dev/admin in Supabase only — see docs/BILLING.md."
            : `Monthly allowance: ${billing?.monthlyGrant ?? "—"} credits${
                billing?.creditsPeriodStart
                  ? ` · period started ${new Date(billing.creditsPeriodStart).toLocaleDateString()}`
                  : ""
              }`}
        </p>
        <p className="text-xs text-muted-foreground">
          Each premium AI action deducts credits on the server before the model runs. Unused credits do not roll over.
        </p>
      </Card>

      <Card title="Credit costs (per action)">
        {costRows.length ? (
          <ul className="divide-y divide-border/60">
            {costRows.map(([key, cost]) => (
              <li key={key} className="flex items-center justify-between py-2 text-sm">
                <span>{CREDIT_ACTION_LABELS[key] || key.replace(/_/g, " ")}</span>
                <span className="font-medium tabular-nums">{cost}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Costs will appear once billing is configured.</p>
        )}
      </Card>

      {!billing?.stripeConfigured ? (
        <p className="text-xs text-muted-foreground">
          Pro checkout is not configured yet (Stripe secrets on the backend). Free-tier credits still apply when the
          database migration is applied.
        </p>
      ) : null}
    </div>
  );
}
