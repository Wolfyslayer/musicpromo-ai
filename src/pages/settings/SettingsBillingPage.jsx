import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import DailyClaimPanel from "@/components/billing/DailyClaimPanel";
import PlanAndCreditsPicker from "@/components/billing/PlanAndCreditsPicker";
import { useToast } from "@/components/ui/use-toast";
import { CREDIT_ACTION_LABELS, fetchBillingStatus, PLAN_LABELS } from "@/services/billingService";

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
      const purchase = searchParams.get("purchase");
      const pack = searchParams.get("pack");
      const plan = searchParams.get("plan");
      const interval = searchParams.get("interval");
      if (purchase === "credits" && pack) {
        toast({
          title: "Credit purchase complete",
          description: "Your balance updates when Stripe confirms payment (usually within a minute).",
        });
      } else {
        toast({
          title: "Subscription started",
          description: plan
            ? `Your ${PLAN_LABELS[plan] || plan} plan${interval ? ` (${interval}ly)` : ""} activates when Stripe confirms payment.`
            : "Credits refresh when Stripe confirms payment.",
        });
      }
      searchParams.delete("checkout");
      searchParams.delete("plan");
      searchParams.delete("interval");
      searchParams.delete("purchase");
      searchParams.delete("pack");
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
  const paidPlan = billing?.plan && billing.plan !== "free";
  const planLabel = exempt
    ? roleLabel || "Staff"
    : PLAN_LABELS[billing?.plan] || (paidPlan ? billing.plan : "Free");

  return (
    <div className="space-y-4">
      <Card title="Your plan">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5 text-primary" />
              {planLabel}
              {billing?.billingInterval ? (
                <span className="text-sm font-normal text-muted-foreground">({billing.billingInterval}ly)</span>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {exempt
                ? "Unlimited premium AI — credits are not deducted for this account."
                : paidPlan
                  ? "Includes Suno-style songs, stem splitter, and a larger monthly credit pool."
                  : "Free tier with monthly credits. Subscribe for AI songs, stems, and more credits."}
            </p>
            {billing?.premiumFeatures?.suno_generation ? (
              <p className="mt-2 text-xs text-primary">
                Premium:{" "}
                <Link to="/premium" className="underline">
                  AI songs & stems
                </Link>
              </p>
            ) : null}
            {billing?.subscriptionRenewsAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Renews {new Date(billing.subscriptionRenewsAt).toLocaleDateString()} · status{" "}
                {billing.subscriptionStatus || "active"}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {!exempt ? (
        <Card title="Plans & credit packs">
          <PlanAndCreditsPicker
            catalog={billing?.planCatalog}
            planComparison={billing?.planComparison}
            creditPackCatalog={billing?.creditPackCatalog}
            stripeConfigured={billing?.stripeConfigured}
            creditPacksConfigured={billing?.creditPacksConfigured}
            currentPlan={paidPlan ? billing.plan : "free"}
            onCheckoutStart={(err) => {
              if (err) toast({ variant: "destructive", title: "Checkout unavailable", description: err.message });
            }}
          />
        </Card>
      ) : null}

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
          Campaign plans and cloud video clips are free. Cover art, content, Suno, and stems use credits. Claim daily 🎁
          in the header for extras.
        </p>
      </Card>

      {!exempt ? (
        <Card title="Daily credits">
          <p className="text-sm text-muted-foreground">
            Tap <span aria-hidden>🎁</span> in the header on any page to claim your 7-day streak.
          </p>
          <DailyClaimPanel
            dailyClaim={billing?.dailyClaim}
            creditsBalance={billing?.creditsBalance}
            billingExempt={false}
            showPlanLink={false}
          />
        </Card>
      ) : null}

      <Card title="Always free">
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Full campaign plan generation</li>
          <li>Cloud AI motion clip (when enabled)</li>
          <li>On-device promo video render (Remotion)</li>
        </ul>
      </Card>

      <Card title="Premium (Creator+)">
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>AI song generation (Suno API)</li>
          <li>Stem splitter (vocals / drums / bass / other)</li>
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
    </div>
  );
}
