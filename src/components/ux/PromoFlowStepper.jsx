import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal step indicator for release → promo → launch flows.
 */
export default function PromoFlowStepper({ labels, currentIndex }) {
  if (!labels?.length) return null;

  return (
    <ol className="grid gap-2 sm:grid-cols-[repeat(var(--steps),minmax(0,1fr))]" style={{ "--steps": labels.length }}>
      {labels.map((label, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li
            key={label}
            className={cn(
              "relative flex min-h-11 items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium transition",
              active && "border-primary/40 bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]",
              done && "border-primary/20 bg-primary/5 text-primary",
              !active && !done && "border-border/60 bg-muted/20 text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold tabular-nums",
                active && "bg-primary text-primary-foreground",
                done && "bg-primary/20 text-primary",
                !active && !done && "bg-muted text-muted-foreground"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span className="leading-tight">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
