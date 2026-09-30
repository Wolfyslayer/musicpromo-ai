import { cn } from "@/lib/utils";

export default function StatCard({ label, value, icon: Icon, accent = "primary", sub }) {
  const accents = {
    primary: "text-primary",
    accent: "text-accent",
    "chart-3": "text-chart-3",
    "chart-1": "text-chart-1",
  };
  return (
    <div className="card-gradient rounded-2xl border border-border/60 p-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <span className="text-xs font-500 uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && <Icon className={cn("h-4 w-4", accents[accent])} />}
      </div>
      <div className="mt-2 font-heading text-2xl font-700 tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}