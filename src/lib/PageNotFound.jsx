import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1) || "/";

  const { data: authData, isFetched } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      try {
        const user = await db.auth.me();
        return { user, isAuthenticated: true };
      } catch {
        return { user: null, isAuthenticated: false };
      }
    },
  });

  return (
    <div className="app-gradient flex min-h-dvh items-center justify-center p-6">
      <div className="surface w-full max-w-md rounded-3xl p-8 text-center animate-fade-in">
        <div className="mb-6 flex justify-center">
          <Logo size={40} withWord={false} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">404</p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{pageName}</span> is not a route in this app.
        </p>
        {isFetched && authData?.isAuthenticated && authData.user?.role === "admin" ? (
          <p className="mt-4 rounded-xl bg-muted/50 p-3 text-left text-xs text-muted-foreground">
            Admin: add a route in <code className="text-foreground">App.jsx</code> or fix the link that sent users here.
          </p>
        ) : null}
        <Button asChild className="mt-6 w-full rounded-full">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
