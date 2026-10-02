import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Film, Sparkles, BarChart3, ListChecks, LayoutGrid, Share2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { loadCampaign } from "@/services/data";
import { campaignProgress } from "@/services/format";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import ProgressBar from "@/components/ProgressBar";
import CampaignPlan from "@/components/campaign/CampaignPlan";
import ContentLibrary from "@/components/campaign/ContentLibrary";
import SongAnalysis from "@/components/campaign/SongAnalysis";
import CampaignVideos from "@/components/campaign/CampaignVideos";
import CampaignAnalytics from "@/components/campaign/CampaignAnalytics";

export default function CampaignDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = params.get("tab") || "plan";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const reload = () => {
    loadCampaign(id).then(setData).catch((e) => setError(e.message));
  };
  useEffect(() => { reload(); }, [id]);

  if (error) return <p className="text-destructive">{error}</p>;
  if (!data) return <div className="h-64 animate-shimmer rounded-2xl" />;

  const { campaign, song, artist, days, analytics, videos, content } = data;
  const progress = campaignProgress(days);

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/campaigns")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to campaigns
      </button>

      <div className="overflow-hidden rounded-3xl border border-border/60 card-gradient">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <ArtworkImage src={song?.artwork_url} alt={song?.title} className="h-36 w-36 shrink-0 sm:h-28 sm:w-28" rounded="rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={campaign.status} />
            </div>
            <h1 className="mt-2 truncate font-heading text-2xl font-700">{song?.title || "Untitled"}</h1>
            <p className="truncate text-sm text-muted-foreground">{artist?.name} · {fmtRange(campaign)}</p>
            {campaign.summary && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{campaign.summary}</p>}
            <div className="mt-3 max-w-md">
              <ProgressBar value={progress} showLabel />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => navigate(`/campaigns/${id}/content`)}
              >
                <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> Content Workspace
              </Button>
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

      {song && <SongAnalysis song={{ ...song, artistName: artist?.name }} onRefresh={reload} />}

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="grid w-full grid-cols-4 rounded-xl">
          <TabsTrigger value="plan" className="rounded-xl text-xs sm:text-sm"><ListChecks className="mr-1 h-4 w-4" />Plan</TabsTrigger>
          <TabsTrigger value="content" className="rounded-xl text-xs sm:text-sm"><Sparkles className="mr-1 h-4 w-4" />Content</TabsTrigger>
          <TabsTrigger value="videos" className="rounded-xl text-xs sm:text-sm"><Film className="mr-1 h-4 w-4" />Videos</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-xl text-xs sm:text-sm"><BarChart3 className="mr-1 h-4 w-4" />Analytics</TabsTrigger>
        </TabsList>

        <div className="mt-5">
          {tab === "plan" && <CampaignPlan campaign={campaign} days={days} song={{ ...song, artistName: artist?.name }} onRefresh={reload} />}
          {tab === "content" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Generate AI assets here, or open the Content Workspace to browse by campaign day.
                </p>
                <Button size="sm" variant="outline" className="shrink-0 rounded-full" onClick={() => navigate(`/campaigns/${id}/content`)}>
                  <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> Open Workspace
                </Button>
              </div>
              <ContentLibrary campaign={campaign} song={{ ...song, artistName: artist?.name }} content={content} onRefresh={reload} />
            </div>
          )}
          {tab === "videos" && (
            <CampaignVideos campaign={campaign} videos={videos} song={song} onRefresh={reload} />
          )}
          {tab === "analytics" && <CampaignAnalytics campaign={campaign} analytics={analytics} days={days} onRefresh={reload} />}
        </div>
      </Tabs>
    </div>
  );
}

function fmtRange(c) {
  return `${c.start_date || ""} → ${c.end_date || ""}`;
}
