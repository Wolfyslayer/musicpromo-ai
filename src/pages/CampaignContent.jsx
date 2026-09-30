import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, ListChecks, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { loadCampaignContent } from "@/services/data";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import ContentWorkspace from "@/components/campaign/ContentWorkspace";

export default function CampaignContent() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const focusDayId = params.get("day") || null;
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const reload = () =>
    loadCampaignContent(id)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load content"));

  useEffect(() => {
    setError("");
    setData(null);
    reload();
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate("/campaigns")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to campaigns
        </button>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) return <div className="h-64 animate-shimmer rounded-2xl" />;

  const { campaign, song, artist, release, days, content, videos } = data;

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate(`/campaigns/${id}`)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Campaign
      </button>

      <div className="overflow-hidden rounded-3xl border border-border/60 card-gradient">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <ArtworkImage
            src={release?.artwork_url || song?.artwork_url}
            alt={song?.title || campaign.name}
            className="h-28 w-28 shrink-0"
            rounded="rounded-2xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={campaign.status || "draft"} />
              <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Content Workspace
              </span>
            </div>
            <h1 className="mt-2 truncate font-heading text-2xl font-700">
              {song?.title || campaign.name || "Campaign Content"}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {artist?.name || "Unknown artist"}
              {release?.title ? ` · ${release.title}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => navigate(`/campaigns/${id}?tab=plan`)}
              >
                <ListChecks className="mr-1.5 h-3.5 w-3.5" /> Plan
              </Button>
              {campaign.release_id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => navigate(`/releases/${campaign.release_id}/calendar`)}
                >
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> Calendar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => navigate("/social")}
              >
                <Share2 className="mr-1.5 h-3.5 w-3.5" /> Social
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ContentWorkspace
        campaign={campaign}
        song={song}
        artist={artist}
        release={release}
        days={days}
        content={content}
        videos={videos}
        onRefresh={reload}
        focusDayId={focusDayId}
        embedLibrary
      />
    </div>
  );
}
