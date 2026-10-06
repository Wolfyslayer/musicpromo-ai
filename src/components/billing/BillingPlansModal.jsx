import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import PlanAndCreditsPicker from "@/components/billing/PlanAndCreditsPicker";
import StripeEmbeddedCheckoutDialog from "@/components/billing/StripeEmbeddedCheckoutDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { BILLING_REFRESH_EVENT } from "@/lib/billingEvents";
import { fetchBillingStatus, PLAN_LABELS, resolvePublishableKey } from "@/services/billingService";

export default function BillingPlansModal({ open, onOpenChange }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [billing, setBilling] = useState(null);
  const [checkoutUi, setCheckoutUi] = useState(null);

  const publishableKey = resolvePublishableKey(billing?.stripePublishableKey);

  const finishCheckoutToast = (meta) => {
    if (meta?.packId || meta?.checkoutType === "credit_pack") {
      toast({
        title: "Credit purchase complete",
        description: "Your balance updates when Stripe confirms payment (usually within a minute).",
      });
      return;
    }
    const plan = meta?.plan;
    const interval = meta?.interval;
    toast({
      title: "Subscription started",
      description: plan
        ? `Your ${PLAN_LABELS[plan] || plan} plan${interval ? ` (${interval}ly)` : ""} activates when Stripe confirms payment.`
        : "Credits refresh when Stripe confirms payment.",
    });
  };

  const load = useCallback(() => {
    setLoading(true);
    fetchBillingStatus()
      .then(setBilling)
      .catch(() => setBilling(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    const onRefresh = () => load();
    window.addEventListener(BILLING_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(BILLING_REFRESH_EVENT, onRefresh);
  }, [load]);

  const exempt = Boolean(billing?.billingExempt);
  const paidPlan = billing?.plan && billing.plan !== "free";
  const roleLabel =
    billing?.appRole === "admin" ? "Admin" : billing?.appRole === "dev" ? "Developer" : null;
  const planLabel = exempt
    ? roleLabel || "Staff"
    : PLAN_LABELS[billing?.plan] || (paidPlan ? billing.plan : "Free");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
          <DialogHeader className="shrink-0 text-left">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Plans & credits
            </DialogTitle>
            <DialogDescription>
              {exempt ? (
                "Staff account — unlimited premium AI."
              ) : (
                <>
                  <span className="font-medium text-foreground">{planLabel}</span>
                  {billing?.billingInterval ? ` · ${billing.billingInterval}ly` : ""}
                  {" · "}
                  <span className="tabular-nums">{billing?.creditsBalance ?? "—"}</span> credits left this period
                  {billing?.monthlyGrant ? ` (${billing.monthlyGrant}/mo allowance)` : ""}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {loading && !billing ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : exempt ? (
              <p className="text-sm text-muted-foreground">Credits are not deducted for dev/admin accounts.</p>
            ) : (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  Credits power promo campaign plans, AI cover art, and optional cloud clips.{" "}
                  <Link to="/artwork" className="text-primary underline" onClick={() => onOpenChange(false)}>
                    Open Cover lab
                  </Link>
                </p>
                <PlanAndCreditsPicker
                  catalog={billing?.planCatalog}
                  planComparison={billing?.planComparison}
                  creditPackCatalog={billing?.creditPackCatalog}
                  stripeConfigured={billing?.stripeConfigured}
                  creditPacksConfigured={billing?.creditPacksConfigured}
                  stripeEmbeddedCheckout={billing?.stripeEmbeddedCheckout}
                  currentPlan={paidPlan ? billing.plan : "free"}
                  onCheckoutStart={(err) => {
                    if (err) toast({ variant: "destructive", title: "Checkout unavailable", description: err.message });
                  }}
                  onCheckoutSession={(session) => {
                    setCheckoutUi({
                      clientSecret: session.clientSecret,
                      sessionKey: session.sessionId,
                      meta: session,
                    });
                  }}
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <StripeEmbeddedCheckoutDialog
        open={Boolean(checkoutUi?.clientSecret)}
        onOpenChange={(openState) => {
          if (!openState) setCheckoutUi(null);
        }}
        publishableKey={publishableKey}
        clientSecret={checkoutUi?.clientSecret}
        sessionKey={checkoutUi?.sessionKey}
        onComplete={() => {
          const meta = checkoutUi?.meta;
          setCheckoutUi(null);
          finishCheckoutToast(meta);
          load();
          window.dispatchEvent(new CustomEvent(BILLING_REFRESH_EVENT));
        }}
      />
    </>
  );
}
