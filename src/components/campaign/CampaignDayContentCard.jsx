import { useNavigate } from "react-router-dom";
import { Film, Clock, Share2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

import { fmtDate } from "@/services/format";
import { platformColor } from "@/services/constants";
import { buildComposePath } from "@/services/socialService";
import { useCountdown } from "@/hooks/useCountdown";
import StatusBadge from "@/components/StatusBadge";
import VideoPreview from "@/components/VideoPreview";
import PromoTextCard from "@/components/campaign/PromoTextCard";
import CreateVideoButton from "@/components/video/CreateVideoButton";

/**
 * One CampaignDay's promotional assets (fields live on CampaignDay itself).
 * GeneratedContent has no day link — day copy comes from the plan fields.
 */
export default function CampaignDayContentCard({
  day,
  campaignId,
  video,
  song,
  filter = "all",
  highlight = false,
}) {
  const navigate = useNavigate();
  const countdown = useCountdown(day.scheduled_at);
  const showCaptions = filter === "all" || filter === "captions";
  const showHooks = filter === "all" || filter === "hooks";
  const showHashtags = filter === "all" || filter === "hashtags";
  const showVideos = filter === "all" || filter === "videos";

  const hasText =
    (showCaptions && day.caption) ||
    (showHooks && day.hook) ||
    (showHashtags && day.hashtags) ||
    (filter === "all" && (day.cta || day.video_concept));
  const hasVideo = showVideos && video;

  if (filter !== "all" && filter !== "artwork" && !hasText && !hasVideo) {
    return null;
  }

  return (
    <article
      id={`day-${day.id}`}
      className={`scroll-mt-24 rounded-2xl border p-4 ${
        highlight ? "border-primary/50 bg-primary/5" : "border-border/60 bg-card/50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            Day {day.day_number || "—"}
            {day.date ? ` · ${fmtDate(day.date)}` : ""}
            {day.posting_time ? (
              <span className="ml-2 inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {day.posting_time}
              </span>
            ) : null}
          </p>
          <h3 className="mt-0.5 truncate font-heading text-base font-600">
            {day.content_type || day.objective || `Day ${day.day_number || ""}`}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {day.platform && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-600"
                style={{ background: `${platformColor(day.platform)}22`, color: platformColor(day.platform) }}
              >
                {day.platform}
              </span>
            )}
            <StatusBadge status={day.status || "planned"} />
            {day.status === "scheduled" && day.scheduled_at && (
              <span className="text-xs text-muted-foreground">{countdown.label}</span>
            )}
            {(day.status === "posted" || day.live_permalink) && day.live_permalink && (
              <a
                href={day.live_permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Live <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => navigate(`/campaigns/${campaignId}?tab=plan`)}
          >
            Open Plan
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() =>
              navigate(
                buildComposePath({
                  campaignId,
                  campaignDayId: day.id,
                })
              )
            }
          >
            <Share2 className="mr-1 h-3.5 w-3.5" /> Post to Social
          </Button>
        </div>
      </div>

      {day.objective && filter === "all" && (
        <p className="mt-3 text-sm text-muted-foreground">{day.objective}</p>
      )}

      <div className="mt-3 space-y-2">
        {showHooks && <PromoTextCard label="HOOK" text={day.hook} />}
        {showCaptions && <PromoTextCard label="CAPTION" text={day.caption} />}
        {showHashtags && <PromoTextCard label="HASHTAGS" text={day.hashtags} />}
        {filter === "all" && <PromoTextCard label="CTA" text={day.cta} />}
        {filter === "all" && day.video_concept && (
          <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
            <p className="text-[10px] font-700 uppercase tracking-wider text-muted-foreground">Video concept</p>
            <p className="mt-1 text-sm break-words">{day.video_concept}</p>
          </div>
        )}
      </div>

      {hasVideo && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-700 uppercase tracking-wider text-muted-foreground">Video</p>
          <div className="mx-auto max-w-[200px]">
            <VideoPreview project={{ ...video, lyrics: song?.lyrics }} />
          </div>
          <div className="mt-3 flex justify-center">
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => navigate(`/campaigns/${campaignId}/video?project=${video.id}`)}
            >
              <Film className="mr-1.5 h-3.5 w-3.5" /> Open Video
            </Button>
          </div>
        </div>
      )}

      {showVideos && !video && filter === "videos" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <p className="w-full text-sm text-muted-foreground">No video linked to this day yet.</p>
          <CreateVideoButton campaignId={campaignId} dayId={day.id} className="rounded-full">
            <Film className="mr-1.5 h-3.5 w-3.5" /> Create Video
          </CreateVideoButton>
        </div>
      )}

      {!hasText && !hasVideo && filter === "all" && (
        <p className="mt-3 text-sm text-muted-foreground">No promotional copy on this day yet. Edit it in the campaign plan.</p>
      )}
    </article>
  );
}
