// @ts-nocheck
import { View, Text, Pressable, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useRouter } from 'expo-router';
import { Film, Clock, Share2, ExternalLink } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';

import { fmtDate } from "@/services/format";
import { platformColor } from "@/services/constants";
import { buildComposePath } from "@/services/socialService";
import { useCountdown } from "@/hooks/useCountdown";
import { StatusBadge } from '@/components/StatusBadge';
import VideoPreview from '@/components/VideoPreview';
import PromoTextCard from "@/components/campaign/PromoTextCard";
import CreateVideoButton from '@/components/video/CreateVideoButton';

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
  const router = useRouter();
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
    <View
      id={`day-${day.id}`}
      className={`scroll-mt-24 rounded-2xl border p-4 ${
        highlight ? "border-primary/50 bg-primary/5" : "border-border/60 bg-card/50"
      }`}
    >
      <View className="flex flex-wrap items-start justify-between gap-2">
        <View className="min-w-0">
          <View className="text-xs text-muted-foreground">
            Day {day.day_number || "—"}
            {day.date ? ` · ${fmtDate(day.date)}` : ""}
            {day.posting_time ? (
              <View className="ml-2 inline-flex items-center gap-1">
                <Clock />
                {day.posting_time}
              </View>
            ) : null}
          </View>
          <View className="mt-0.5 truncate font-heading text-base font-600">
            {day.content_type || day.objective || `Day ${day.day_number || ""}`}
          </View>
          <View className="mt-1.5 flex flex-wrap items-center gap-2">
            {day.platform && (
              <View
                className="rounded-full px-2 py-0.5 text-xs font-600"
                style={{ background: `${platformColor(day.platform)}22`, color: platformColor(day.platform) }}
              >
                {day.platform}
              </View>
            )}
            <StatusBadge status={day.status || "planned"} />
            {day.status === "scheduled" && day.scheduled_at && (
              <View className="text-xs text-muted-foreground">{countdown.label}</View>
            )}
            {(day.status === "posted" || day.live_permalink) && day.live_permalink && (
              <View
                href={day.live_permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Live <ExternalLink />
              </View>
            )}
          </View>
        </View>
        <View className="flex flex-wrap gap-2">
          <Button
            variant="outline"
           
            className="rounded-full"
            onPress={() => router.push(`/campaigns/${campaignId}?tab=plan`)}
          >
            Open Plan
          </Button>
          <Button
            variant="outline"
           
            className="rounded-full"
            onPress={() =>
              router.push(
                buildComposePath({
                  campaignId,
                  campaignDayId: day.id,
                })
              )
            }
          >
            <Share2 /> Post to Social
          </Button>
        </View>
      </View>

      {day.objective && filter === "all" && (
        <View className="mt-3 text-sm text-muted-foreground">{day.objective}</View>
      )}

      <View className="mt-3 space-y-2">
        {showHooks && <PromoTextCard label="HOOK" text={day.hook} />}
        {showCaptions && <PromoTextCard label="CAPTION" text={day.caption} />}
        {showHashtags && <PromoTextCard label="HASHTAGS" text={day.hashtags} />}
        {filter === "all" && <PromoTextCard label="CTA" text={day.cta} />}
        {filter === "all" && day.video_concept && (
          <View className="rounded-xl border border-border/50 bg-muted/30 p-3">
            <View className="text-[10px] font-700 uppercase tracking-wider text-muted-foreground">Video concept</View>
            <View className="mt-1 text-sm break-words">{day.video_concept}</View>
          </View>
        )}
      </View>

      {hasVideo && (
        <View className="mt-4">
          <View className="mb-2 text-[10px] font-700 uppercase tracking-wider text-muted-foreground">Video</View>
          <View className="mx-auto max-w-[200px]">
            <VideoPreview project={{ ...video, lyrics: song?.lyrics }} />
          </View>
          <View className="mt-3 flex justify-center">
            <Button
             
              className="rounded-full"
              onPress={() => router.push(`/campaigns/${campaignId}/video?project=${video.id}`)}
            >
              <Film /> Open Video
            </Button>
          </View>
        </View>
      )}

      {showVideos && !video && filter === "videos" && (
        <View className="mt-3 flex flex-wrap gap-2">
          <View className="w-full text-sm text-muted-foreground">No video linked to this day yet.</View>
          <CreateVideoButton campaignId={campaignId} dayId={day.id} className="rounded-full">
            <Film /> Create Video
          </CreateVideoButton>
        </View>
      )}

      {!hasText && !hasVideo && filter === "all" && (
        <View className="mt-3 text-sm text-muted-foreground">No promotional copy on this day yet. Edit it in the campaign plan.</View>
      )}
    </View>
  );
}
