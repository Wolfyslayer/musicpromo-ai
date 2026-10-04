import { cn } from "@/lib/utils";
import { DAY_UX_STATUS, resolveDayUxStatus } from "@/lib/dayUxStatus";

const TONE = {
  muted: "bg-muted/60 text-muted-foreground",
  primary: "bg-primary/14 text-primary",
  amber: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  success: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  destructive: "bg-destructive/15 text-destructive",
};

export default function DayStatusChip({ day, posts = [], className }) {
  const status = resolveDayUxStatus(day, posts);
  const meta = DAY_UX_STATUS[status.id] || DAY_UX_STATUS.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        TONE[meta.tone] || TONE.muted,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.label}
    </span>
  );
}
