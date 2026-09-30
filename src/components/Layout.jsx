import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ListMusic, Plus, BarChart3, Settings, LogOut, Users, Disc3, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import Logo from "./Logo";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/campaigns", label: "Campaigns", icon: ListMusic },
  { to: "/create", label: "Create", icon: Plus, center: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

const SECONDARY = [
  { to: "/artists", label: "Artists", icon: Users },
  { to: "/releases", label: "Releases", icon: Disc3 },
  { to: "/social", label: "Social", icon: Share2 },
];

function NavButton({ item, active }) {
  const Icon = item.icon;
  if (item.center) {
    return (
      <Link
        to={item.to}
        className={cn(
          "relative -mt-6 grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg transition active:scale-95",
          active && "ring-2 ring-white/40"
        )}
        style={{ background: "linear-gradient(135deg, hsl(265 90% 68%), hsl(326 85% 62%))" }}
        aria-label={item.label}
      >
        <Icon className="h-6 w-6" />
      </Link>
    );
  }
  return (
    <Link
      to={item.to}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 py-1.5 text-[10px] font-500 transition",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{item.label}</span>
    </Link>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const isActive = (to) => (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to));

  const handleLogout = () => {
    logout(false);
    toast({ title: "Signed out" });
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <Logo size={26} />
        <button
          onClick={handleLogout}
          className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/50 bg-sidebar/40 p-4 md:flex">
          <div className="px-2 py-2">
            <Logo />
          </div>
          <nav className="mt-6 flex flex-1 flex-col gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-500 transition",
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {item.label}
                </Link>
              );
            })}
            <div className="my-2 h-px bg-border/50" />
            {SECONDARY.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-500 transition",
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-xl border border-border/50 bg-muted/30 p-3">
            <p className="truncate text-sm font-600">{user?.full_name || user?.email || "Artist"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            <button
              onClick={handleLogout}
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="app-gradient min-h-screen flex-1">
          <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 md:px-8 md:pb-12 md:pt-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-end justify-around border-t border-border/50 bg-background/90 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5 backdrop-blur md:hidden">
        {NAV.map((item) => (
          <NavButton key={item.to} item={item} active={isActive(item.to)} />
        ))}
      </nav>
    </div>
  );
}