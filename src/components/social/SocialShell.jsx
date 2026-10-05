import { Navigate, Outlet, useLocation } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import SectionNavMenu from "@/components/navigation/SectionNavMenu";
import { SocialHubProvider } from "@/contexts/SocialHubContext";
import { SOCIAL_SECTIONS } from "@/lib/socialNav";

function SocialShellInner() {
  return (
    <div className="space-y-5 pb-2">
      <div className="glass-bar sticky top-0 z-20 -mx-4 space-y-3 border-b border-border/40 px-4 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
        <PageHeader
          eyebrow="Social"
          title="Social Hub"
          description="Connect platforms, manage drafts, and review publish history."
          className="!animate-none"
        />
        <SectionNavMenu basePath="/social" sections={SOCIAL_SECTIONS} />
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
  const { search } = useLocation();
  return <Navigate to={`/social/connect${search}`} replace />;
}
