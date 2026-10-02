import { useRouter } from 'expo-router';
import { Calendar, Film, MoreVertical } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { ArtworkImage } from '@/components/ArtworkImage';
import { Badge } from '@/components/ui/Badge';
import { fmtDateShort } from '@/services/format';

export function CampaignCard({
  campaign,
  song,
  artist,
  daysCount = 0,
  videosCount = 0,
  onAction,
}: {
  campaign: { id: string; status?: string; start_date?: string; end_date?: string; release?: { title?: string } };
  song?: { title?: string; artwork_url?: string };
  artist?: { name?: string };
  daysCount?: number;
  videosCount?: number;
  onAction?: (c: { id: string }) => void;
}) {
  const router = useRouter();
  return (
    <Pressable
      className="overflow-hidden rounded-2xl border border-border bg-card"
      onPress={() => router.push(`/campaigns/${campaign.id}`)}
    >
      <View className="flex-row gap-3 p-3">
        <ArtworkImage src={song?.artwork_url} className="h-20 w-20" rounded="rounded-xl" />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-2">
              <Text className="font-semibold text-foreground" numberOfLines={1}>
                {song?.title || 'Untitled'}
              </Text>
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {artist?.name || 'Unknown artist'}
              </Text>
            </View>
            {onAction ? (
              <Pressable
                onPress={() => onAction(campaign)}
                className="h-8 w-8 items-center justify-center rounded-lg"
              >
                <MoreVertical color="#64748b" size={18} />
              </Pressable>
            ) : null}
          </View>
          <View className="mt-2">
            <Badge status={campaign.status} />
          </View>
          {campaign.release?.title ? (
            <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={1}>
              Release: {campaign.release.title}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="flex-row items-center justify-between border-t border-border px-3 py-2">
        <View className="flex-row items-center gap-1">
          <Calendar color="#64748b" size={14} />
          <Text className="text-xs text-muted-foreground">
            {fmtDateShort(campaign.start_date)} — {fmtDateShort(campaign.end_date)}
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground">
          {daysCount} days · {videosCount} videos
        </Text>
      </View>
    </Pressable>
  );
}
