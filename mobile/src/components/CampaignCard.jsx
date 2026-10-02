import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Calendar, Film, MoreVertical } from "lucide-react-native";
import ArtworkImage from "./ArtworkImage";
import StatusBadge from "./StatusBadge";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { fmtDate, fmtDateShort, daysUntil } from "@/services/format";

export default function CampaignCard({ campaign, song, artist, daysCount = 0, videosCount = 0, onAction }) {
  return (
    <Pressable
      onPress={() => router.push(`/campaigns/${campaign.id}`)}
      className="overflow-hidden rounded-2xl border border-border/60 bg-card active:border-primary/40"
    >
      <View className="flex-row gap-3 p-3">
        <ArtworkImage src={song?.artwork_url} className="h-20 w-20" rounded="rounded-xl" />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <View className="min-w-0 flex-1">
              <Text className="font-heading text-base" numberOfLines={1}>
                {song?.title || "Untitled"}
              </Text>
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {artist?.name || "Unknown artist"}
              </Text>
            </View>
            {onAction ? (
              <Pressable onPress={() => onAction(campaign)} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-lg">
                <Icon as={MoreVertical} size={16} className="text-muted-foreground" />
              </Pressable>
            ) : null}
          </View>
          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <StatusBadge status={campaign.status} />
          </View>
          {campaign.release?.title ? (
            <Text className="mt-1.5 text-xs text-muted-foreground" numberOfLines={1}>
              Release: {campaign.release.title}
            </Text>
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

export function CampaignCountdown({ campaign }) {
  const d = daysUntil(campaign.start_date);
  if (campaign.status === "active") return <Text className="text-xs text-chart-2">Live now</Text>;
  if (d === null) return null;
  if (d < 0) return <Text className="text-xs text-muted-foreground">Started {fmtDate(campaign.start_date)}</Text>;
  if (d === 0) return <Text className="text-xs text-chart-3">Starts today</Text>;
  return <Text className="text-xs text-muted-foreground">Starts in {d} day{d === 1 ? "" : "s"}</Text>;
}
