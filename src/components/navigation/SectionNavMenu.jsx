import { Menu } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Mobile hamburger + desktop horizontal tabs for nested section routes.
 * @param {{ basePath: string, sections: { segment: string, label: string, shortLabel?: string, icon: import("react").ComponentType }[], title?: string }} props
 */
export default function SectionNavMenu({ basePath, sections, title = "Sections" }) {
  const location = useLocation();
  const trail = location.pathname.replace(basePath, "").replace(/^\//, "");
  const activeSegment = trail.split("/")[0] || sections[0]?.segment;

  const linkClass = (isActive) =>
    cn(
      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-500 transition",
      isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
    );

  const tabClass = (isActive) =>
    cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-600 transition sm:text-sm",
      isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
    );

  return (
    <>
      <div className="flex items-center gap-2 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-10 rounded-full px-3">
              <Menu className="mr-1.5 h-4 w-4" />
              Menu
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(100%,20rem)] p-0">
            <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
              <SheetTitle className="font-heading text-base">{title}</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 p-3">
              {sections.map((item) => {
                const Icon = item.icon;
                const to = `${basePath}/${item.segment}`;
                return (
                  <NavLink key={item.segment} to={to} className={({ isActive }) => linkClass(isActive)}>
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
        <span className="truncate text-sm font-600 text-foreground">
          {sections.find((s) => s.segment === activeSegment)?.label || title}
        </span>
      </div>

      <nav className="hidden gap-1 overflow-x-auto no-scrollbar md:flex md:flex-wrap">
        {sections.map((item) => {
          const Icon = item.icon;
          const to = `${basePath}/${item.segment}`;
          return (
            <NavLink key={item.segment} to={to} className={({ isActive }) => tabClass(isActive)} end={false}>
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.shortLabel || item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
