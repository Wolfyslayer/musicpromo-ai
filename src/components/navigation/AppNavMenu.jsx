import { Menu } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from "@/components/ui/sheet";
import Logo from "@/components/Logo";

export default function AppNavMenu({ primary, secondary, userLine, footerActions }) {
  const location = useLocation();
  const isActive = (to) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const linkClass = (active) =>
    cn(
      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition duration-200",
      active
        ? "bg-primary/12 font-semibold text-primary"
        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
    );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[min(100%,20rem)] flex-col p-0">
        <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
          <Logo size={28} />
          {userLine ? <p className="pt-2 text-xs text-muted-foreground">{userLine}</p> : null}
        </SheetHeader>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {primary.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={linkClass(isActive(item.to))}>
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
          <div className="my-2 h-px bg-border/50" />
          {secondary.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={linkClass(isActive(item.to))}>
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {footerActions ? (
          <div className="mt-auto border-t border-border/60 p-3">{footerActions}</div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
