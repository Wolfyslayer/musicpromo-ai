import { useRouter } from 'expo-router';
import { Clock, ExternalLink, Film, Share2 } from 'lucide-react-native';
import { Linking, Pressable, View } from 'react-native';

import StatusBadge from '@/components/StatusBadge';
import { VideoPreview } from '@/components/campaign/CampaignVideos';
import { useCountdown } from '@/components/campaign/CampaignPlan';
import PromoTextCard from '@/components/campaign/PromoTextCard';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import CreateVideoButton from '@/components/video/CreateVideoButton';
import { cn } from '@/lib/utils';
import { platformColor } from '@/services/constants';
import { fmtDate } from '@/services/format';
import { buildComposePath } from '@/services/socialService';

type Props = {
  day: any;
  campaignId: string;
  video?: any;
  song?: any;
  filter?: string;
  highlight?: boolean;
};

/**
 * One CampaignDay's promotional assets (fields live on CampaignDay itself).
 * GeneratedContent has no day link — day copy comes from the plan fields.
 */
export default function CampaignDayContentCard({ day, campaignId, video, song, filter = 'all', highlight = false }: Props) {
  const router = useRouter();
  const countdown = useCountdown(day.scheduled_at);
  const showCaptions = filter === 'all' || filter === 'captions';
  const showHooks = filter === 'all' || filter === 'hooks';
  const showHashtags = filter === 'all' || filter === 'hashtags';
  const showVideos = filter === 'all' || filter === 'videos';

  const hasText = (showCaptions && day.caption) || (showHooks && day.hook) || (showHashtags && day.hashtags) || (filter === 'all' && (day.cta || day.video_concept));
  const hasVideo = showVideos && video;

  if (filter !== 'all' && filter !== 'artwork' && !hasText && !hasVideo) return null;

  const color = platformColor(day.platform);

  return (
    <View className={cn('rounded-2xl border p-4', highlight ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-card/50')}>
      <View className="gap-2">
        <View>
          <View className="flex-row flex-wrap items-center gap-x-2">
            <Text className="text-xs text-muted-foreground">
              Day {day.day_number || '—'}
              {day.date ? ` · ${fmtDate(day.date)}` : ''}
            </Text>
            {day.posting_time ? (
              <View className="flex-row items-center gap-1">
                <Icon as={Clock} size={12} className="text-muted-foreground" />
                <Text className="text-xs text-muted-foreground">{day.posting_time}</Text>
              </View>
            ) : null}
          </View>
          <Text className="mt-0.5 font-heading text-base" numberOfLines={2}>
            {day.content_type || day.objective || `Day ${day.day_number || ''}`}
          </Text>
          <View className="mt-1.5 flex-row flex-wrap items-center gap-2">
            {day.platform ? (
              <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${color}22` }}>
                <Text className="text-xs font-semibold" style={{ color }}>
                  {day.platform}
                </Text>
              </View>
            ) : null}
            <StatusBadge status={day.status || 'planned'} />
            {day.status === 'scheduled' && day.scheduled_at ? <Text className="text-xs text-muted-foreground">{countdown.label}</Text> : null}
            {day.live_permalink ? (
              <Pressable hitSlop={6} onPress={() => Linking.openURL(day.live_permalink)} className="flex-row items-center gap-1">
                <Text className="text-xs text-primary">Live</Text>
                <Icon as={ExternalLink} size={12} className="text-primary" />
              </Pressable>
            ) : null}
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onPress={() => router.push(`/campaigns/${campaignId}?tab=plan` as any)}>
            Open Plan
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" onPress={() => router.push(buildComposePath({ campaignId, campaignDayId: day.id }) as any)}>
            <Icon as={Share2} size={14} />
            <Text className="text-xs font-medium">Post to Social</Text>
          </Button>
        </View>
      </View>

      {day.objective && filter === 'all' ? <Text className="mt-3 text-sm text-muted-foreground">{day.objective}</Text> : null}

      <View className="mt-3 gap-2">
        {showHooks ? <PromoTextCard label="HOOK" text={day.hook} /> : null}
        {showCaptions ? <PromoTextCard label="CAPTION" text={day.caption} /> : null}
        {showHashtags ? <PromoTextCard label="HASHTAGS" text={day.hashtags} /> : null}
        {filter === 'all' ? <PromoTextCard label="CTA" text={day.cta} /> : null}
        {filter === 'all' && day.video_concept ? (
          <View className="rounded-xl border border-border/50 bg-muted/30 p-3">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Video concept</Text>
            <Text className="mt-1 text-sm">{day.video_concept}</Text>
          </View>
        ) : null}
      </View>

      {hasVideo ? (
        <View className="mt-4">
          <Text className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Video</Text>
          <View className="w-48 self-center">
            <VideoPreview project={{ ...video, lyrics: song?.lyrics }} />
          </View>
          <View className="mt-3 items-center">
            <Button size="sm" className="rounded-full" onPress={() => router.push(`/campaigns/${campaignId}/video?project=${video.id}` as any)}>
              <Icon as={Film} size={14} className="text-primary-foreground" />
              <Text className="text-xs font-medium text-primary-foreground">Open Video</Text>
            </Button>
          </View>
        </View>
      ) : null}

      {showVideos && !video && filter === 'videos' ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          <Text className="w-full text-sm text-muted-foreground">No video linked to this day yet.</Text>
          <CreateVideoButton campaignId={campaignId} dayId={day.id} className="rounded-full">
            <Icon as={Film} size={14} />
            <Text className="text-xs font-medium">Create Video</Text>
          </CreateVideoButton>
        </View>
      ) : null}

      {!hasText && !hasVideo && filter === 'all' ? <Text className="mt-3 text-sm text-muted-foreground">No promotional copy on this day yet. Edit it in the campaign plan.</Text> : null}
    </View>
  );
}
