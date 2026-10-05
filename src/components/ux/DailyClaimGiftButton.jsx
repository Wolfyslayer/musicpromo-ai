import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import DailyClaimPanel from "@/components/billing/DailyClaimPanel";
import { claimDailyCredits, fetchBillingStatus } from "@/services/billingService";
import { useToast } from "@/components/ui/use-toast";

export default function DailyClaimGiftButton() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [billing, setBilling] = useState(null);

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
    if (open) load();
  }, [open, load]);

  const showClaimDot =
    !billing?.billingExempt && billing?.dailyClaim?.canClaimToday && !loading;

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
      setBilling((prev) => ({
        ...prev,
        ...data,
        creditsBalance: data.creditsBalance ?? prev?.creditsBalance,
        dailyClaim: data.dailyClaim ?? prev?.dailyClaim,
      }));
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not claim", description: e.message });
    } finally {
      setClaimBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
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
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
