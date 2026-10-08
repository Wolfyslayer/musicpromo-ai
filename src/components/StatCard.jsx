import { cn } from "@/lib/utils";

export default function StatCard({ label, value, icon: Icon, accent = "primary", sub }) {
  const accents = {
    primary: "text-primary",
    accent: "text-accent",
    "chart-3": "text-chart-3",
    "chart-1": "text-chart-1",
  };
  return (
    <div className="surface rounded-2xl p-3.5 animate-slide-up">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
        {Icon ? <Icon className={cn("h-3.5 w-3.5", accents[accent])} strokeWidth={1.75} /> : null}
      </div>
      <div className="mt-1.5 font-heading text-xl font-semibold tracking-tight tabular-nums md:text-2xl">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
