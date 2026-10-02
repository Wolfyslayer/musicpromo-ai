import { ArrowLeft, Share2 } from "lucide-react";
import { Navigate, Outlet, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CampaignProvider, useCampaign } from "@/contexts/CampaignContext";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import ProgressBar from "@/components/ProgressBar";
import SectionNavMenu from "@/components/navigation/SectionNavMenu";
import { CAMPAIGN_SECTIONS, LEGACY_CAMPAIGN_TAB_PATH } from "@/lib/campaignNav";
import { campaignProgress } from "@/services/format";

function CampaignShellInner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { error, campaign, song, artist, days, data } = useCampaign();

  if (error) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate("/campaigns")}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Campaigns
        </button>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) return <div className="h-48 animate-shimmer rounded-2xl" />;

  const progress = campaignProgress(days);
  const basePath = `/campaigns/${id}`;

  return (
    <div className="space-y-4 pb-2 md:space-y-5">
      <button
        type="button"
        onClick={() => navigate("/campaigns")}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground md:min-h-11"
      >
        <ArrowLeft className="h-4 w-4" /> Campaigns
      </button>

      <div className="sticky top-0 z-20 -mx-4 border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:rounded-3xl md:border md:border-border/60 md:px-0 md:py-0 md:backdrop-blur-none">
        <div className="flex gap-3 md:gap-4 md:p-5">
          <ArtworkImage
            src={song?.artwork_url}
            alt={song?.title}
            className="h-14 w-14 shrink-0 rounded-xl md:h-24 md:w-24 md:rounded-2xl"
            rounded="rounded-xl md:rounded-2xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={campaign.status} />
            </div>
            <h1 className="truncate font-heading text-lg font-700 md:mt-1 md:text-2xl">{song?.title || "Untitled"}</h1>
            <p className="truncate text-xs text-muted-foreground md:text-sm">
              {artist?.name} · {fmtRange(campaign)}
            </p>
            <div className="mt-2 max-w-md">
              <ProgressBar value={progress} showLabel />
            </div>
            <div className="mt-2 hidden flex-wrap gap-2 md:flex">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => navigate("/social")}
              >
                <Share2 className="mr-1.5 h-3.5 w-3.5" /> Social
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-3 border-t border-border/40 pt-3 md:px-5 md:pb-4">
          <SectionNavMenu basePath={basePath} sections={CAMPAIGN_SECTIONS} title="Campaign" />
        </div>
      </div>

      <div className="min-h-[50vh]">
        <Outlet />
      </div>
    </div>
  );
}

export default function CampaignShell() {
  return (
    <CampaignProvider>
      <CampaignShellInner />
    </CampaignProvider>
  );
}

function fmtRange(c) {
  return `${c.start_date || ""} → ${c.end_date || ""}`;
}

/** Index route helper */
export function CampaignIndexRedirect() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const tab = params.get("tab");
  const segment = tab && LEGACY_CAMPAIGN_TAB_PATH[tab];
  if (segment) {
    return <Navigate to={`/campaigns/${id}/${segment}`} replace />;
  }
  return <Navigate to={`/campaigns/${id}/plan`} replace />;
}
