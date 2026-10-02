import { cn } from "@/lib/utils";

export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-muted/25 px-6 py-16 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-background shadow-[var(--shadow-soft)] ring-1 ring-border/50">
          <Icon className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
        </div>
      ) : null}
      <h3 className="font-heading text-lg font-semibold tracking-tight">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
