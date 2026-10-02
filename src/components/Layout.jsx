import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ListMusic, Plus, BarChart3, Settings, LogOut, LogIn, Users, Disc3, Share2, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import Logo from "./Logo";
import AppNavMenu from "./navigation/AppNavMenu";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/studio", label: "Studio", icon: Film },
  { to: "/campaigns", label: "Campaigns", icon: ListMusic },
  { to: "/create", label: "Create", icon: Plus },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

const SECONDARY = [
  { to: "/artists", label: "Artists", icon: Users },
  { to: "/releases", label: "Releases", icon: Disc3 },
  { to: "/social", label: "Social", icon: Share2 },
];

const MOBILE_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/studio", label: "Generator", icon: Film },
  { to: "/social", label: "Social Hub", icon: Share2 },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];

function SideLink({ item, active }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-500 transition",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <Icon className="h-4.5 w-4.5" />
      {item.label}
    </Link>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, requireAuth } = useAuth();
  const { toast } = useToast();

  const isActive = (to) => (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to));
  const isStudio = location.pathname === "/studio" || /\/campaigns\/[^/]+\/video$/.test(location.pathname);
  const isCampaignSection = /^\/campaigns\/[^/]+(\/(plan|library|content|videos|analytics|song))?$/.test(
    location.pathname
  );
  const isSectionHub =
    isCampaignSection ||
    location.pathname.startsWith("/social") ||
    location.pathname.startsWith("/settings");

  const handleLogout = () => {
    logout(false);
    toast({ title: "Signed out" });
    navigate("/");
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground md:flex-row">
      <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-border/50 bg-sidebar/40 p-4 md:flex">
        <div className="px-2 py-2">
          <Logo />
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto">
          {NAV.map((item) => (
            <SideLink key={item.to} item={item} active={isActive(item.to)} />
          ))}
          <div className="my-2 h-px bg-border/50" />
          {SECONDARY.map((item) => (
            <SideLink key={item.to} item={item} active={isActive(item.to)} />
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-border/50 bg-muted/30 p-3">
          <p className="truncate text-sm font-600">{isAuthenticated ? user?.full_name || user?.email || "Artist" : "Guest preview"}</p>
          <p className="truncate text-xs text-muted-foreground">{isAuthenticated ? user?.email : "Sign in to save your work"}</p>
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          ) : (
            <button
              onClick={() => requireAuth()}
              className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-xs font-600 text-primary hover:text-primary"
            >
              <LogIn className="h-3.5 w-3.5" /> Sign in
            </button>
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-background/90 px-3 backdrop-blur md:hidden">
          {isSectionHub ? (
            <span className="min-w-0 truncate pl-1 text-sm font-600">
              {isCampaignSection ? "Campaign" : location.pathname.startsWith("/social") ? "Social" : "Settings"}
            </span>
          ) : (
            <Logo size={26} />
          )}
          <AppNavMenu
            primary={NAV}
            secondary={SECONDARY}
            userLine={
              isAuthenticated
                ? user?.full_name || user?.email || "Signed in"
                : "Guest preview — sign in to save"
            }
            footerActions={
              isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => requireAuth()}
                  className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-600 text-primary hover:bg-primary/10"
                >
                  <LogIn className="h-4 w-4" /> Sign in
                </button>
              )
            }
          />
        </header>

        {!isAuthenticated && !isStudio ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-primary/20 bg-primary/10 px-4 py-2">
            <p className="text-xs text-foreground sm:text-sm">Preview mode. Look around, then sign in to upload, export, or connect.</p>
            <button
              type="button"
              onClick={() => requireAuth()}
              className="min-h-11 shrink-0 rounded-full bg-primary px-4 text-sm font-600 text-primary-foreground"
            >
              Sign in
            </button>
          </div>
        ) : null}

        <main className={cn("app-gradient min-h-0 flex-1", isStudio ? "overflow-hidden" : "overflow-y-auto")}>
          {isStudio ? (
            <Outlet />
          ) : (
            <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-8 md:py-8">
              <Outlet />
            </div>
          )}
        </main>

        <nav className="grid shrink-0 grid-cols-4 border-t border-border/50 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-600",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
