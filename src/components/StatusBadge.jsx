import { cn } from "@/lib/utils";
import { statusMeta } from "@/services/constants";

const COLOR_MAP = {
  muted: "bg-muted/60 text-muted-foreground",
  primary: "bg-primary/14 text-primary",
  "chart-1": "bg-chart-1/14 text-chart-1",
  "chart-2": "bg-chart-2/14 text-chart-2",
  "chart-3": "bg-chart-3/14 text-chart-3",
};

export default function StatusBadge({ status, className }) {
  const meta = statusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize tracking-wide",
        COLOR_MAP[meta.color] || COLOR_MAP.muted,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}