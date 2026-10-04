import { Link } from "react-router-dom";
import { ArrowRight, Rocket } from "lucide-react";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import ProgressBar from "@/components/ProgressBar";
import { Button } from "@/components/ui/button";

export default function ReleaseCommandHero({ campaign, releaseId, releaseTitle, artworkUrl, readyVideosCount = 0 }) {
  if (!campaign || !releaseId) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/80 to-card/40 p-5 animate-slide-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <ArtworkImage src={artworkUrl || campaign.song?.artwork_url} alt="" className="h-28 w-28 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-600 uppercase tracking-wider text-primary">Resume release</p>
          <h2 className="font-heading text-2xl font-semibold truncate">{releaseTitle || campaign.song?.title || "Your release"}</h2>
          <p className="text-sm text-muted-foreground">{campaign.artist?.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={campaign.status} />
            {readyVideosCount > 0 ? (
              <span className="text-xs text-muted-foreground">{readyVideosCount} video{readyVideosCount === 1 ? "" : "s"} ready</span>
            ) : null}
          </div>
          <div className="mt-3 max-w-md">
            <ProgressBar value={campaign.progressValue || 0} showLabel />
          </div>
        </div>
        <Button size="lg" className="shrink-0 rounded-full" asChild>
          <Link to={`/releases/${releaseId}/launch`}>
            <Rocket className="mr-2 h-4 w-4" />
            Open command center
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
