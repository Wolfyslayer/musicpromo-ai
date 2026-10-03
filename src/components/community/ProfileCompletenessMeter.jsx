import { Progress } from "@/components/ui/progress";

export default function ProfileCompletenessMeter({ completeness, compact = false }) {
  if (!completeness) return null;
  const score = completeness.score ?? 0;
  const items = completeness.items || [];
  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Profile strength</span>
          <span className="font-medium text-foreground">{score}%</span>
        </div>
        <Progress value={score} className="h-1.5" />
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-600">Profile completeness</p>
        <span className="text-sm font-semibold text-primary">{score}%</span>
      </div>
      <Progress value={score} className="h-2" />
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${item.done ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
              aria-hidden
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
