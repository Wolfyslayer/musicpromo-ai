import { cn } from "@/lib/utils";

/**
 * Large-title page header (iOS-style hierarchy).
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  titleClassName,
  compact = false,
}) {
  return (
    <header className={cn("animate-fade-in", compact ? "space-y-0" : "", className)}>
      <div
        className={cn(
          "flex flex-col gap-2.5",
          actions ? "md:flex-row md:items-start md:justify-between md:gap-4" : ""
        )}
      >
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</p>
          ) : null}
          <h1
            className={cn(
              "font-heading font-semibold leading-tight tracking-tight text-foreground",
              compact ? "text-xl md:text-[1.65rem]" : "text-[1.65rem] md:text-[1.85rem]",
              eyebrow ? "mt-0.5" : "",
              titleClassName
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "mt-1.5 max-w-2xl text-muted-foreground",
                compact ? "line-clamp-2 text-sm leading-snug" : "text-[15px] leading-relaxed"
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end md:pt-0.5">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
