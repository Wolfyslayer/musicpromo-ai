import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarClock, ExternalLink, Globe2, Loader2, Send, Share2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import DayStatusChip from "@/components/ux/DayStatusChip";
import DayFixCards from "@/components/ux/DayFixCards";
import LaunchDayScheduleControls from "@/components/launch/LaunchDayScheduleControls";
import SocialPlatformPreview, { isVideoMediaUrl } from "@/components/social/SocialPlatformPreview";
import { fmtDate } from "@/services/format";
import { platformColor } from "@/services/constants";
import {
  buildComposePath,
  kickCampaignWorker,
  scheduleCampaignDay,
  SOCIAL_PROVIDERS,
} from "@/services/socialService";
import { primaryProviderForDayPlatform } from "@/services/social/dayPlatform";
import { useToast } from "@/components/ui/use-toast";
import { pushActivity } from "@/lib/activityInbox";
import { resolveDayUxStatus } from "@/lib/dayUxStatus";
import ComposeInlinePanel from "@/components/ux/ComposeInlinePanel";

export default function DayActionDrawer({
  open,
  onOpenChange,
  day,
  campaign,
  release,
  posts = [],
  artworkUrl,
  artistName,
  onRefresh,
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [scheduling, setScheduling] = useState(false);
  const [nudging, setNudging] = useState(false);

  const providerId = useMemo(
    () => primaryProviderForDayPlatform(day?.platform),
    [day?.platform]
  );
  const providerLabel = SOCIAL_PROVIDERS.find((p) => p.id === providerId)?.name || day?.platform || "Social";

  const livePost = posts.find((p) => p.status === "published" && (p.externalPermalink || p.external_permalink));
  const uxStatus = resolveDayUxStatus(day, posts);

  const caption = [day?.caption, day?.hashtags, day?.cta].filter(Boolean).join("\n\n");
  const postMedia = posts[0]?.mediaUrl || posts[0]?.media_url || "";
  const mediaType = posts[0]?.mediaType || posts[0]?.media_type || "IMAGE";

  const openFullCompose = () => {
    if (!campaign?.id || !day?.id) return;
    onOpenChange(false);
    navigate(
      buildComposePath({
        campaignId: campaign.id,
        campaignDayId: day.id,
        releaseId: release?.id || campaign.release_id,
        platform: day.platform,
      })
    );
  };

  const runSchedule = async () => {
    setScheduling(true);
    try {
      const res = await scheduleCampaignDay({ campaignDayId: day.id });
      if (!res?.ok) {
        pushActivity({
          level: "error",
          title: "Schedule failed",
          message: res?.error || "Could not schedule",
          href: `/campaigns/${campaign.id}/plan`,
        });
        toast({ variant: "destructive", title: "Could not schedule", description: res?.error });
        return;
      }
      toast({ title: "Queued for auto-publish", description: res?.message });
      onRefresh?.();
    } catch (e) {
      pushActivity({
        level: "error",
        title: "Schedule failed",
        message: e.message,
        href: `/campaigns/${campaign.id}/plan`,
      });
      toast({ variant: "destructive", title: "Schedule failed", description: e.message });
    } finally {
      setScheduling(false);
    }
  };

  const runPublishNow = async () => {
    setNudging(true);
    try {
      const res = await kickCampaignWorker({ skipVideo: true, skipStats: true, batchLimit: 15 });
      if (res?.publishBlocked) {
        pushActivity({
          level: "error",
          title: "Auto-publish blocked",
          message: String(res.publishBlocked),
          href: "/social/health",
        });
      }
      toast({ title: "Worker ran", description: "Refreshing status…" });
      onRefresh?.();
    } catch (e) {
      pushActivity({ level: "error", title: "Publish worker failed", message: e.message });
      toast({ variant: "destructive", title: "Worker failed", description: e.message });
    } finally {
      setNudging(false);
    }
  };

  if (!day || !campaign) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-heading">
            Day {day.day_number ?? "—"} · {fmtDate(day.date)}
          </SheetTitle>
          <SheetDescription>{campaign.name || "Campaign day"}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <DayStatusChip day={day} posts={posts} />
            <span
              className="rounded-full px-2 py-0.5 text-xs font-600"
              style={{
                background: `${platformColor(day.platform)}22`,
                color: platformColor(day.platform),
              }}
            >
              {day.platform}
            </span>
          </div>

          <DayFixCards day={day} campaign={campaign} onOpenCompose={openFullCompose} />

          {uxStatus.id === "live" && livePost ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <p className="font-600">Live on {livePost.provider || providerId}</p>
              {(livePost.externalPermalink || livePost.external_permalink) && (
                <a
                  href={livePost.externalPermalink || livePost.external_permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                >
                  View post <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <Button size="sm" variant="outline" className="mt-2 rounded-full" asChild>
                <Link to="/community">Ask for repost in Community</Link>
              </Button>
            </div>
          ) : null}

          <p className="text-sm whitespace-pre-wrap">{caption || "No caption yet."}</p>

          <SocialPlatformPreview
            caption={caption}
            mediaUrl={postMedia}
            mediaType={mediaType}
            artworkUrl={
              isVideoMediaUrl(postMedia) ? artworkUrl : artworkUrl || postMedia
            }
            username={artistName || ""}
            defaultPlatform={providerId}
            lockPlatform
            compact
          />

          <LaunchDayScheduleControls day={day} onScheduled={onRefresh} />

          {uxStatus.id !== "live" ? (
            <ComposeInlinePanel
              day={day}
              campaign={campaign}
              release={release}
              posts={posts}
              onPublished={onRefresh}
            />
          ) : null}

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="rounded-full"
              disabled={scheduling}
              onClick={runSchedule}
            >
              {scheduling ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="mr-1.5 h-4 w-4" />
              )}
              Queue auto-publish
            </Button>
            {uxStatus.id === "due" ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={nudging}
                onClick={runPublishNow}
              >
                {nudging ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                Publish now (worker)
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="rounded-full" onClick={openFullCompose}>
              <Share2 className="mr-1.5 h-4 w-4" />
              Open full editor ({providerLabel})
            </Button>
            <Button type="button" variant="ghost" className="rounded-full" asChild>
              <Link to={`/campaigns/${campaign.id}/plan`}>Open full plan</Link>
            </Button>
            <Button type="button" variant="ghost" className="rounded-full" asChild>
              <Link to="/community">
                <Globe2 className="mr-1.5 h-4 w-4" />
                Community promo partners
              </Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
