import { Share2 } from "lucide-react";
import { Navigate, Outlet } from "react-router-dom";
import SectionNavMenu from "@/components/navigation/SectionNavMenu";
import { SocialHubProvider } from "@/contexts/SocialHubContext";
import { SOCIAL_SECTIONS } from "@/lib/socialNav";

function SocialShellInner() {
  return (
    <div className="space-y-4 pb-2">
      <div className="sticky top-0 z-20 -mx-4 border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Share2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-600 uppercase tracking-wider">Social</span>
          </div>
          <h1 className="mt-1 font-heading text-xl font-700 tracking-tight md:text-2xl">Social Hub</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect platforms, manage drafts, and review publish history.
          </p>
        </div>
        <div className="mt-3 border-t border-border/40 pt-3 md:mt-4">
          <SectionNavMenu basePath="/social" sections={SOCIAL_SECTIONS} title="Social Hub" />
        </div>
      </div>
      <Outlet />
    </div>
  );
}

export default function SocialShell() {
  return (
    <SocialHubProvider>
      <SocialShellInner />
    </SocialHubProvider>
  );
}

export function SocialIndexRedirect() {
  return <Navigate to="/social/connect" replace />;
}
