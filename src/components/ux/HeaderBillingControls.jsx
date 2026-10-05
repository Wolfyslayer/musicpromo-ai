import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import BillingPlansModal from "@/components/billing/BillingPlansModal";
import DailyClaimPanel from "@/components/billing/DailyClaimPanel";
import {
  BILLING_OPEN_PLANS_EVENT,
  BILLING_REFRESH_EVENT,
  dispatchBillingRefresh,
} from "@/lib/billingEvents";
import { claimDailyCredits, fetchBillingStatus } from "@/services/billingService";
import { useToast } from "@/components/ui/use-toast";

export default function HeaderBillingControls() {
  const { toast } = useToast();
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [giftOpen, setGiftOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchBillingStatus()
      .then(setBilling)
      .catch(() => setBilling(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => load();
    const onOpenPlans = () => setPlansOpen(true);
    window.addEventListener(BILLING_REFRESH_EVENT, onRefresh);
    window.addEventListener(BILLING_OPEN_PLANS_EVENT, onOpenPlans);
    return () => {
      window.removeEventListener(BILLING_REFRESH_EVENT, onRefresh);
      window.removeEventListener(BILLING_OPEN_PLANS_EVENT, onOpenPlans);
    };
  }, [load]);

  useEffect(() => {
    if (giftOpen) load();
  }, [giftOpen, load]);

  const exempt = Boolean(billing?.billingExempt);
  const showClaimDot = !exempt && billing?.dailyClaim?.canClaimToday && !loading;

  const creditsLabel = exempt ? "∞" : loading && billing == null ? "…" : String(billing?.creditsBalance ?? "—");

  const onClaim = async () => {
    setClaimBusy(true);
    try {
      const data = await claimDailyCredits();
      if (data?.billingExempt) {
        toast({ title: "Staff account", description: data.message });
        load();
        return;
      }
      toast({
        title: `+${data.reward} credits`,
        description: `Day ${data.streakDay} of 7 this month${data.streakDay === 3 ? " (2× bonus)" : data.streakDay === 7 ? " (4× bonus)" : ""}.`,
      });
      load();
      dispatchBillingRefresh();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not claim", description: e.message });
    } finally {
      setClaimBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          data-tour="header-credits"
          aria-label={exempt ? "Staff unlimited credits" : `${creditsLabel} AI credits. Open plans and upgrades.`}
          className="h-9 gap-1 rounded-full px-2.5 tabular-nums sm:px-3"
          onClick={() => setPlansOpen(true)}
        >
          <span className="text-sm font-semibold">{creditsLabel}</span>
          {!exempt ? (
            <span className="hidden text-xs font-normal text-muted-foreground sm:inline">credits</span>
          ) : null}
        </Button>

        <Sheet open={giftOpen} onOpenChange={setGiftOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-tour="daily-claim-gift"
              aria-label="Daily credit claim"
              className="relative h-9 w-9 rounded-full text-lg leading-none"
            >
              <span aria-hidden>🎁</span>
              {showClaimDot ? (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-sm">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span aria-hidden>🎁</span> Daily credits
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              {loading && !billing ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <DailyClaimPanel
                  dailyClaim={billing?.dailyClaim}
                  creditsBalance={billing?.creditsBalance}
                  billingExempt={billing?.billingExempt}
                  claimBusy={claimBusy}
                  onClaim={onClaim}
                  showPlanLink={false}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <BillingPlansModal
        open={plansOpen}
        onOpenChange={(open) => {
          setPlansOpen(open);
          if (!open) load();
        }}
      />
    </>
  );
}
