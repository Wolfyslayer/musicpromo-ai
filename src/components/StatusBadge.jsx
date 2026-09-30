import { cn } from "@/lib/utils";
import { statusMeta } from "@/services/constants";

const COLOR_MAP = {
  muted: "bg-muted/40 text-muted-foreground border-border",
  primary: "bg-primary/15 text-primary border-primary/30",
  "chart-1": "bg-chart-1/15 text-chart-1 border-chart-1/30",
  "chart-2": "bg-chart-2/15 text-chart-2 border-chart-2/30",
  "chart-3": "bg-chart-3/15 text-chart-3 border-chart-3/30",
};

export default function StatusBadge({ status, className }) {
  const meta = statusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-500 capitalize",
        COLOR_MAP[meta.color] || COLOR_MAP.muted,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}