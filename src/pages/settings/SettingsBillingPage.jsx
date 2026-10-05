import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard, Gift, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  CREDIT_ACTION_LABELS,
  claimDailyCredits,
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
  const [claimBusy, setClaimBusy] = useState(false);
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

  const onClaim = async () => {
    setClaimBusy(true);
    try {
      const data = await claimDailyCredits();
      if (data?.billingExempt) {
        toast({ title: "Staff account", description: data.message });
        return;
      }
      setBilling((prev) => ({ ...prev, ...data, creditsBalance: data.creditsBalance ?? prev?.creditsBalance }));
      toast({
        title: `+${data.reward} credits`,
        description: `Day ${data.streakDay} of 7 this month${data.streakDay === 3 ? " (2× bonus)" : data.streakDay === 7 ? " (4× bonus)" : ""}.`,
      });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not claim", description: e.message });
    } finally {
      setClaimBusy(false);
    }
  };

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
          Campaign plans and cloud video clips are free. Cover art and content tools use credits. Unused monthly credits do
          not roll over.
        </p>
      </Card>

      {!exempt && billing?.dailyClaim ? (
        <Card title="7-day monthly claim">
          <p className="text-sm text-muted-foreground">
            Claim once per UTC day. Miss a day and the streak restarts. Day 3 pays 2×, day 7 pays 4× (base{" "}
            {billing.dailyClaim.baseCreditsPerDay} credits). Resets when your monthly credits reset.
          </p>
          <div className="grid grid-cols-7 gap-1.5 pt-2">
            {(billing.dailyClaim.schedule || []).map((d) => (
              <div
                key={d.day}
                className={`rounded-xl border px-1 py-2 text-center text-[11px] leading-tight ${
                  d.claimed
                    ? "border-primary/40 bg-primary/15 text-foreground"
                    : d.isBonusDay
                      ? "border-amber-500/35 bg-amber-500/10"
                      : "border-border/60 bg-muted/20 text-muted-foreground"
                }`}
              >
                <div className="font-semibold">D{d.day}</div>
                <div className="tabular-nums">{d.credits}</div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            className="mt-3 w-full rounded-full sm:w-auto"
            disabled={claimBusy || !billing.dailyClaim.canClaimToday}
            onClick={onClaim}
          >
            {claimBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Gift className="mr-2 h-4 w-4" />
            )}
            {billing.dailyClaim.canClaimToday
              ? `Claim ${billing.dailyClaim.nextReward ?? ""} credits`
              : billing.dailyClaim.allClaimedThisMonth
                ? "All claims used this month"
                : "Claimed today — back tomorrow"}
          </Button>
        </Card>
      ) : null}

      <Card title="Always free">
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Full campaign plan generation</li>
          <li>Cloud AI motion clip (when enabled)</li>
          <li>On-device promo video render (Remotion)</li>
        </ul>
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
