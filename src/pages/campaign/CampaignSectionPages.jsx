import { LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCampaign } from "@/contexts/CampaignContext";
import CampaignPlan from "@/components/campaign/CampaignPlan";
import CampaignCommunityShare from "@/components/campaign/CampaignCommunityShare";
import ContentLibrary from "@/components/campaign/ContentLibrary";
import SongAnalysis from "@/components/campaign/SongAnalysis";
import CampaignVideos from "@/components/campaign/CampaignVideos";
import CampaignAnalytics from "@/components/campaign/CampaignAnalytics";
import { campaignSectionPath } from "@/lib/campaignNav";

export function CampaignPlanPage() {
  const { id, campaign, days, song, artist, reload } = useCampaign();
  return (
    <div className="space-y-4">
      <CampaignPlan
        campaign={campaign}
        days={days}
        song={{ ...song, artistName: artist?.name }}
        onRefresh={reload}
      />
      <CampaignCommunityShare campaign={campaign} onUpdated={reload} />
    </div>
  );
}

export function CampaignLibraryPage() {
  const { id, campaign, song, artist, content, reload } = useCampaign();
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Generate AI assets here, or browse posts by day in the content workspace.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 rounded-full"
          onClick={() => navigate(campaignSectionPath(id, "content"))}
        >
          <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> Open workspace
        </Button>
      </div>
      <ContentLibrary
        campaign={campaign}
        song={{ ...song, artistName: artist?.name }}
        content={content}
        onRefresh={reload}
      />
    </div>
  );
}

export function CampaignVideosPage() {
  const { campaign, videos, song, reload } = useCampaign();
  return <CampaignVideos campaign={campaign} videos={videos} song={song} onRefresh={reload} />;
}

export function CampaignAnalyticsPage() {
  const { campaign, analytics, days, reload } = useCampaign();
  return (
    <CampaignAnalytics campaign={campaign} analytics={analytics} days={days} onRefresh={reload} />
  );
}

export function CampaignSongPage() {
  const { song, artist, reload } = useCampaign();
  if (!song) return null;
  return <SongAnalysis song={{ ...song, artistName: artist?.name }} onRefresh={reload} />;
}
