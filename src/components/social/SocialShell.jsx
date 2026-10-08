import { Navigate, Outlet, useLocation } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import SectionNavMenu from "@/components/navigation/SectionNavMenu";
import SectionChrome from "@/components/ux/SectionChrome";
import { SocialHubProvider } from "@/contexts/SocialHubContext";
import { SOCIAL_SECTIONS } from "@/lib/socialNav";

function SocialShellInner() {
  return (
    <SectionChrome
      header={
        <PageHeader
          compact
          eyebrow="Social"
          title="Social Hub"
          description="Connect accounts, queue posts, and review what went live."
          className="!animate-none"
        />
      }
      nav={<SectionNavMenu basePath="/social" sections={SOCIAL_SECTIONS} />}
    >
      <Outlet />
    </SectionChrome>
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
