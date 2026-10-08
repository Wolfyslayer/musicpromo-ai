import { cn } from "@/lib/utils";

/**
 * iOS-style segmented control for in-page tabs (not router links).
 */
export default function SegmentedTabs({ value, onChange, items, className }) {
  const cols =
    items.length <= 2
      ? "grid-cols-2"
      : items.length === 3
        ? "grid-cols-3"
        : items.length === 4
          ? "grid-cols-4"
          : "grid-cols-2 sm:grid-cols-4";

  return (
    <div className={cn("segmented-scroll", className)}>
      <div className={cn("segmented grid min-w-max sm:min-w-0 sm:w-full", cols)} role="tablist">
        {items.map((item) => {
          const active = value === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.id)}
              className={cn(
                "segmented-item w-full px-2",
                active && "bg-background text-foreground shadow-[0_1px_3px_hsl(var(--foreground)/0.08)]"
              )}
            >
              {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
              <span className="truncate">{item.label}</span>
              {item.badge != null && item.badge !== 0 ? (
                <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
