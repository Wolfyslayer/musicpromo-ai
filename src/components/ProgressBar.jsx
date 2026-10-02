import { cn } from "@/lib/utils";

export default function ProgressBar({ value = 0, className, showLabel = false }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted/80", className)}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${v}%`,
            background: "linear-gradient(90deg, hsl(265 90% 68%), hsl(326 85% 62%))",
          }}
        />
      </div>
      {showLabel && <div className="mt-1 text-right text-xs text-muted-foreground">{v}%</div>}
    </div>
  );
}