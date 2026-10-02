import { MoreHorizontal } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CAMPAIGN_EXTRA_SECTIONS, CAMPAIGN_PRIMARY_TABS } from "@/lib/campaignNav";

/**
 * Mobile + desktop campaign nav — matches the 4-tab strip from the campaign screenshot.
 */
export default function CampaignTabBar({ basePath }) {
  const tabClass = (isActive) =>
    cn(
      "inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-xl px-1 text-xs font-600 transition sm:text-sm",
      isActive
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    );

  const extraLinkClass = (isActive) =>
    cn(
      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-500 transition",
      isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
    );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted/50 p-1">
        {CAMPAIGN_PRIMARY_TABS.map((item) => {
          const Icon = item.icon;
          const to = `${basePath}/${item.segment}`;
          return (
            <NavLink key={item.segment} to={to} className={({ isActive }) => tabClass(isActive)} end>
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.shortLabel}</span>
            </NavLink>
          );
        })}
      </div>

      {CAMPAIGN_EXTRA_SECTIONS.length ? (
        <div className="flex justify-end md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-9 rounded-full px-3 text-xs">
                <MoreHorizontal className="mr-1 h-4 w-4" />
                More
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader className="text-left">
                <SheetTitle className="font-heading text-base">More campaign tools</SheetTitle>
              </SheetHeader>
              <nav className="mt-3 flex flex-col gap-1 pb-4">
                {CAMPAIGN_EXTRA_SECTIONS.map((item) => {
                  const Icon = item.icon;
                  const to = `${basePath}/${item.segment}`;
                  return (
                    <NavLink key={item.segment} to={to} className={({ isActive }) => extraLinkClass(isActive)}>
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      ) : null}

      <nav className="hidden flex-wrap gap-1 md:flex">
        {CAMPAIGN_EXTRA_SECTIONS.map((item) => {
          const Icon = item.icon;
          const to = `${basePath}/${item.segment}`;
          return (
            <NavLink
              key={item.segment}
              to={to}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-600 sm:text-sm",
                  isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/50"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
