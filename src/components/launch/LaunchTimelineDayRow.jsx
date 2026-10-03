import { useState } from "react";
import { ChevronDown, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import LaunchDayScheduleControls from "@/components/launch/LaunchDayScheduleControls";
import SocialPlatformPreview from "@/components/social/SocialPlatformPreview";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/services/format";
import { buildComposePath } from "@/services/socialService";

export default function LaunchTimelineDayRow({
  item,
  artworkUrl,
  artistName,
  onRefresh,
}) {
  const navigate = useNavigate();
  const [showPreview, setShowPreview] = useState(false);
  const day = item.day;
  const campaign = item.campaign;
  const post = item.posts?.[0];

  return (
    <div className="rounded-xl border border-border/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {fmtDate(item.date)} · Day {day.day_number ?? "—"} · {campaign?.name || "Campaign"}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm">{day.caption || day.theme || "No caption yet"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={day.status || "pending"} />
            {post ? <StatusBadge status={post.status} /> : null}
            {day.scheduled_at ? (
              <span className="text-[10px] text-muted-foreground">
                Scheduled {new Date(day.scheduled_at).toLocaleString()}
              </span>
            ) : null}
            {day.publish_error ? (
              <span className="text-xs text-destructive">{day.publish_error}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="rounded-full"
            onClick={() => setShowPreview((v) => !v)}
          >
            <ChevronDown className={`mr-1 h-3.5 w-3.5 transition ${showPreview ? "rotate-180" : ""}`} />
            Preview
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => navigate(`/campaigns/${campaign.id}/plan`)}
          >
            Plan
          </Button>
          <Button
            size="sm"
            className="rounded-full"
            onClick={() =>
              navigate(
                buildComposePath({
                  campaignId: campaign.id,
                  campaignDayId: day.id,
                  releaseId: campaign.release_id,
                  platform: day.platform,
                })
              )
            }
          >
            <Share2 className="mr-1.5 h-3.5 w-3.5" />
            Social
          </Button>
        </div>
      </div>

      <LaunchDayScheduleControls day={day} onScheduled={onRefresh} />

      {showPreview ? (
        <div className="mt-3">
          <SocialPlatformPreview
            caption={[day.caption, day.hashtags].filter(Boolean).join("\n\n")}
            mediaUrl={post?.mediaUrl || post?.media_url || ""}
            artworkUrl={artworkUrl}
            username={artistName || campaign?.artist?.name || ""}
          />
        </div>
      ) : null}
    </div>
  );
}
