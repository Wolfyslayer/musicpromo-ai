import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { useAppTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme";
import { CAMPAIGN_STATUSES } from "@/services/constants";

type Campaign = {
  id: string;
  status?: string;
  name?: string;
  progressValue?: number;
  daysCount?: number;
  videosCount?: number;
  artwork_url?: string;
  song?: { title?: string; artwork_url?: string };
  artist?: { name?: string };
};

export function CampaignListCard({
  campaign,
  onPress,
}: {
  campaign: Campaign;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const status = CAMPAIGN_STATUSES.find((s) => s.id === campaign.status);
  const art = campaign.artwork_url || campaign.song?.artwork_url || "";
  const title = campaign.song?.title || campaign.name || "Untitled campaign";
  const subtitle = campaign.artist?.name || "Unknown artist";

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${title} by ${subtitle}, status ${status?.label || campaign.status || "unknown"}`}
    >
      <View style={styles.row}>
        {art ? (
          <Image
            source={{ uri: art }}
            style={styles.art}
            contentFit="cover"
            accessibilityLabel={`${title} artwork`}
          />
        ) : (
          <View
            style={[styles.art, { backgroundColor: colors.muted }]}
            accessibilityLabel="No artwork"
          />
        )}
        <View style={styles.meta}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {title}
          </Text>
          <Text muted numberOfLines={1} variant="caption">
            {subtitle}
          </Text>
          <View style={styles.chips}>
            <View style={[styles.chip, { backgroundColor: colors.secondary }]}>
              <Text variant="caption">{status?.label || campaign.status || "—"}</Text>
            </View>
            <Text muted variant="caption">
              {campaign.daysCount || 0} days · {campaign.videosCount || 0} videos
            </Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.min(100, campaign.progressValue || 0)}%`,
                  backgroundColor: colors.primary,
                },
              ]}
              accessibilityLabel={`Progress ${campaign.progressValue || 0} percent`}
            />
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md },
  art: { width: 64, height: 64, borderRadius: radius.md },
  meta: { flex: 1, gap: 4 },
  chips: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  chip: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  barTrack: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 6 },
  barFill: { height: "100%", borderRadius: 2 },
});
