import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dispatchOpenBillingPlans } from "@/lib/billingEvents";

/**
 * 7-day streak UI — used in header gift sheet and settings.
 * @param {{ dailyClaim: object, creditsBalance?: number|null, billingExempt?: boolean, claimBusy?: boolean, onClaim?: () => void, showPlanLink?: boolean }} props
 */
export default function DailyClaimPanel({
  dailyClaim,
  creditsBalance,
  billingExempt,
  claimBusy,
  onClaim,
  showPlanLink = true,
}) {
  if (billingExempt) {
    return (
      <p className="text-sm text-muted-foreground">
        Staff accounts have unlimited AI credits — no daily claim needed.
      </p>
    );
  }

  if (!dailyClaim) {
    return <p className="text-sm text-muted-foreground">Loading claim status…</p>;
  }

  return (
    <div className="space-y-4">
      {creditsBalance != null ? (
        <p className="text-sm text-muted-foreground">
          Balance: <span className="font-semibold tabular-nums text-foreground">{creditsBalance}</span> credits
          this month
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Claim once per UTC day (up to 7 per month). Miss a day and the streak restarts. Day 3 = 2×, day 7 = 4× base (
        {dailyClaim.baseCreditsPerDay} credits).
      </p>
      <div className="grid grid-cols-7 gap-1.5">
        {(dailyClaim.schedule || []).map((d) => (
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
      {onClaim ? (
        <Button
          type="button"
          className="w-full rounded-full"
          disabled={claimBusy || !dailyClaim.canClaimToday}
          onClick={onClaim}
        >
          {claimBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <span className="mr-2">🎁</span>}
          {dailyClaim.canClaimToday
            ? `Claim ${dailyClaim.nextReward ?? ""} credits`
            : dailyClaim.allClaimedThisMonth
              ? "All claims used this month"
              : "Claimed today — back tomorrow"}
        </Button>
      ) : null}
      {showPlanLink ? (
        <Button
          type="button"
          variant="link"
          className="h-auto w-full p-0 text-xs text-muted-foreground"
          onClick={() => dispatchOpenBillingPlans()}
        >
          Plans, costs & upgrades
        </Button>
      ) : null}
    </div>
  );
}
