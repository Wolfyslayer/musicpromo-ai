import { ArrowLeft, Share2 } from "lucide-react";
import { Navigate, Outlet, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CampaignProvider, useCampaign } from "@/contexts/CampaignContext";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import ProgressBar from "@/components/ProgressBar";
import CampaignTabBar from "@/components/campaign/CampaignTabBar";
import { LEGACY_CAMPAIGN_TAB_PATH } from "@/lib/campaignNav";
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
      <div className="glass-bar sticky top-0 z-20 -mx-4 border-b border-border/40 px-4 py-2 md:static md:mx-0 md:space-y-4 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => navigate("/campaigns")}
            className="inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <ArtworkImage
            src={song?.artwork_url}
            alt={song?.title}
            className="h-10 w-10 shrink-0 rounded-lg"
            rounded="rounded-lg"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-sm font-700">{song?.title || "Untitled"}</p>
            <ProgressBar value={progress} showLabel className="mt-1 h-1.5" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/campaigns")}
          className="mb-2 hidden items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground md:inline-flex"
        >
          <ArrowLeft className="h-4 w-4" /> Campaigns
        </button>

        <div className="hidden overflow-hidden rounded-3xl border border-border/60 card-gradient md:block">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <ArtworkImage
              src={song?.artwork_url}
              alt={song?.title}
              className="h-28 w-28 shrink-0 rounded-2xl"
              rounded="rounded-2xl"
            />
            <div className="min-w-0 flex-1">
              <StatusBadge status={campaign.status} />
              <h1 className="mt-2 truncate font-heading text-2xl font-700">{song?.title || "Untitled"}</h1>
              <p className="truncate text-sm text-muted-foreground">
                {artist?.name} · {fmtRange(campaign)}
              </p>
              {campaign.summary ? (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{campaign.summary}</p>
              ) : null}
              <div className="mt-3 max-w-md">
                <ProgressBar value={progress} showLabel />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
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
        </div>

        <div className="mt-3 border-t border-border/40 pt-3 md:px-5 md:pb-4">
          <CampaignTabBar basePath={basePath} />
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
