import { useRouter } from 'expo-router';
import { Calendar, Film, MoreVertical } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import ArtworkImage from '@/components/ArtworkImage';
import StatusBadge from '@/components/StatusBadge';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { daysUntil, fmtDate, fmtDateShort } from '@/services/format';

export default function CampaignCard({ campaign, song, artist, daysCount = 0, videosCount = 0, onAction }: { campaign: any; song?: any; artist?: any; daysCount?: number; videosCount?: number; onAction?: (campaign: any) => void }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/campaigns/${campaign.id}`)}
      className="overflow-hidden rounded-2xl border border-border/60 bg-card active:border-primary/40">
      <View className="flex-row gap-3 p-3">
        <ArtworkImage src={song?.artwork_url} className="size-20" rounded="rounded-xl" />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="font-heading">{song?.title || 'Untitled'}</Text>
              <Text numberOfLines={1} className="text-sm text-muted-foreground">{artist?.name || 'Unknown artist'}</Text>
            </View>
            {onAction ? (
              <Pressable onPress={() => onAction(campaign)} hitSlop={10} accessibilityLabel="Campaign actions" className="size-7 items-center justify-center rounded-lg">
                <Icon as={MoreVertical} size={16} className="text-muted-foreground" />
              </Pressable>
            ) : null}
          </View>
          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <StatusBadge status={campaign.status} />
          </View>
          {campaign.release?.title ? (
            <Text numberOfLines={1} className="mt-1.5 text-xs text-muted-foreground">Release: {campaign.release.title}</Text>
          ) : null}
        </View>
      </View>
      <View className="flex-row items-center justify-between border-t border-border/40 px-3 py-2">
        <View className="flex-row items-center gap-1">
          <Icon as={Calendar} size={14} className="text-muted-foreground" />
          <Text className="text-xs text-muted-foreground">
            {fmtDateShort(campaign.start_date)} — {fmtDateShort(campaign.end_date)}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <Text className="text-xs text-muted-foreground">{daysCount} days</Text>
          <View className="flex-row items-center gap-1">
            <Icon as={Film} size={14} className="text-muted-foreground" />
            <Text className="text-xs text-muted-foreground">{videosCount}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function CampaignCountdown({ campaign, className }: { campaign: any; className?: string }) {
  const d = daysUntil(campaign.start_date);
  const base = cn('text-xs text-muted-foreground', className);
  if (campaign.status === 'active') return <Text className={cn(base, 'text-chart-2')}>Live now</Text>;
  if (d === null) return null;
  if (d < 0) return <Text className={base}>Started {fmtDate(campaign.start_date)}</Text>;
  if (d === 0) return <Text className={cn(base, 'text-chart-3')}>Starts today</Text>;
  return <Text className={base}>Starts in {d} day{d === 1 ? '' : 's'}</Text>;
}
