import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Sparkles, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { loadReleaseContent } from "@/services/data";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import ContentWorkspace from "@/components/campaign/ContentWorkspace";

export default function ReleaseContent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [activeCampaignId, setActiveCampaignId] = useState(null);

  useEffect(() => {
    setError("");
    setData(null);
    loadReleaseContent(id)
      .then((result) => {
        setData(result);
        setActiveCampaignId(result.campaigns?.[0]?.campaign?.id || null);
      })
      .catch((e) => setError(e.message || "Failed to load release content"));
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate("/releases")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to releases
        </button>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) return <div className="h-64 animate-shimmer rounded-2xl" />;

  const { release, artist, campaigns } = data;
  const active = campaigns.find((c) => c.campaign.id === activeCampaignId) || campaigns[0];

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate(`/releases/${id}`)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Release
      </button>

      <div className="overflow-hidden rounded-3xl border border-border/60 card-gradient">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <ArtworkImage
            src={release.artwork_url}
            alt={release.title}
            className="h-28 w-28 shrink-0"
            rounded="rounded-2xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={release.status || "draft"} />
              <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Release Content
              </span>
            </div>
            <h1 className="mt-2 truncate font-heading text-2xl font-700">{release.title || "Untitled"}</h1>
            <p className="truncate text-sm text-muted-foreground">{artist?.name || "Unknown artist"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => navigate(`/releases/${id}/calendar`)}
              >
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> Calendar
              </Button>
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

      {!campaigns.length ? (
        <EmptyState
          icon={Sparkles}
          title="No campaigns linked to this release yet."
          description="Create a campaign with this release selected to generate promotional content."
          action={
            <Button className="rounded-full" onClick={() => navigate("/create")}>
              Create Campaign
            </Button>
          }
        />
      ) : (
        <>
          {campaigns.length > 1 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {campaigns.map(({ campaign, song }) => (
                <button
                  key={campaign.id}
                  type="button"
                  onClick={() => setActiveCampaignId(campaign.id)}
                  className={`min-h-10 shrink-0 rounded-full px-3.5 py-2 text-xs font-600 transition ${
                    active?.campaign.id === campaign.id
                      ? "bg-primary text-primary-foreground"
                      : "border border-border/60 bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {song?.title || campaign.name || "Campaign"}
                </button>
              ))}
            </div>
          )}

          {active && (
            <ContentWorkspace
              campaign={active.campaign}
              song={active.song}
              artist={artist}
              release={release}
              days={active.days}
              content={active.content}
              videos={active.videos}
              onRefresh={() =>
                loadReleaseContent(id).then((result) => {
                  setData(result);
                  setActiveCampaignId(active.campaign.id);
                })
              }
              embedLibrary
            />
          )}
        </>
      )}
    </div>
  );
}
