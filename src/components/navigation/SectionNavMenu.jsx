import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * iOS-style segmented control for nested section routes (mobile + desktop).
 */
export default function SectionNavMenu({ basePath, sections }) {
  const location = useLocation();
  const trail = location.pathname.replace(basePath, "").replace(/^\//, "");
  const activeSegment = trail.split("/")[0] || sections[0]?.segment;
  const cols = sections.length <= 3 ? "grid-cols-3" : sections.length === 4 ? "grid-cols-4" : "grid-cols-2";

  const tabClass = (isActive) =>
    cn(
      "segmented-item w-full px-1",
      isActive && "bg-background text-foreground shadow-[0_1px_3px_hsl(var(--foreground)/0.08)]"
    );

  return (
    <div className="space-y-2">
      <nav className={cn("segmented grid", cols)}>
        {sections.map((item) => {
          const Icon = item.icon;
          const to = `${basePath}/${item.segment}`;
          return (
            <NavLink key={item.segment} to={to} className={({ isActive }) => tabClass(isActive)} end>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.shortLabel || item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <p className="hidden text-center text-[11px] text-muted-foreground md:block">
        {sections.find((s) => s.segment === activeSegment)?.label}
      </p>
    </div>
  );
}
