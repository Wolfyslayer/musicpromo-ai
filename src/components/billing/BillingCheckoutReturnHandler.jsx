import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { BILLING_REFRESH_EVENT, dispatchOpenBillingPlans } from "@/lib/billingEvents";
import { PLAN_LABELS } from "@/services/billingService";

/** Handles Stripe embedded checkout return query params on any page. */
export default function BillingCheckoutReturnHandler() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout !== "success" && checkout !== "complete") {
      if (checkout === "cancel") {
        toast({ title: "Checkout canceled" });
        searchParams.delete("checkout");
        setSearchParams(searchParams, { replace: true });
      }
      return;
    }

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
    searchParams.delete("session_id");
    searchParams.delete("plan");
    searchParams.delete("interval");
    searchParams.delete("purchase");
    searchParams.delete("pack");
    setSearchParams(searchParams, { replace: true });

    window.dispatchEvent(new CustomEvent(BILLING_REFRESH_EVENT));
    dispatchOpenBillingPlans();
  }, [searchParams, setSearchParams, toast]);

  return null;
}
