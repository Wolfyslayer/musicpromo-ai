import { cn } from "@/lib/utils";

export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-14 text-center", className)}>
      {Icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-muted/60">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
      )}
      <h3 className="font-heading text-lg font-600">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}