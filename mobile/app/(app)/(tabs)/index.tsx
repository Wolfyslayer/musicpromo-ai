import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingBlock } from "@/components/ui/LoadingBlock";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { CampaignListCard } from "@/components/CampaignListCard";
import { loadCampaigns } from "@/services/data";
import { useAuth } from "@/auth/AuthContext";
import { useAppTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme";
import { userFacingError } from "@/lib/errors";

export default function DashboardScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const query = useQuery({
    queryKey: ["campaigns"],
    queryFn: loadCampaigns,
  });

  const campaigns = query.data || [];
  const recent = campaigns.slice(0, 5);
  const active = campaigns.find((c) =>
    ["active", "scheduled", "preparing"].includes(String(c.status))
  );

  return (
    <Screen
      scroll
      contentStyle={{
        // RefreshControl needs ScrollView — Screen already scrolls
      }}
    >
      <OfflineBanner />
      <View style={styles.hero}>
        <Text variant="caption" color={colors.primary}>
          MusicPromo AI
        </Text>
        <Text variant="display">Release promos, on autopilot</Text>
        <Text muted>
          Hi{user?.full_name ? ` ${user.full_name}` : ""}. Short-form plans and videos for real
          releases.
        </Text>
      </View>

      <Button
        title="New promo"
        onPress={() => router.push("/(app)/campaigns/create")}
        accessibilityHint="Create a campaign"
      />

      <View style={styles.actions}>
        <Button
          title="Video studio"
          variant="secondary"
          onPress={() => router.push("/(app)/video")}
          style={styles.half}
        />
        <Button
          title="All campaigns"
          variant="outline"
          onPress={() => router.push("/(app)/(tabs)/campaigns")}
          style={styles.half}
        />
      </View>

      {query.isLoading ? <LoadingBlock label="Loading campaigns…" /> : null}
      {query.isError ? (
        <ErrorBanner
          message={userFacingError(query.error, "Could not load campaigns.")}
          onRetry={() => query.refetch()}
        />
      ) : null}

      {active ? (
        <Card>
          <Text variant="label" muted>
            Active focus
          </Text>
          <Text variant="heading" numberOfLines={2}>
            {(active.song as { title?: string } | undefined)?.title || active.name || "Campaign"}
          </Text>
          <Button
            title="Open campaign"
            variant="secondary"
            onPress={() => router.push(`/(app)/campaigns/${active.id}`)}
          />
        </Card>
      ) : null}

      <Text variant="heading">Recent</Text>
      {query.isSuccess && !recent.length ? (
        <EmptyState
          title="No campaigns yet"
          description="Create a promo with artwork and audio to get started."
          actionLabel="New promo"
          onAction={() => router.push("/(app)/campaigns/create")}
        />
      ) : (
        recent.map((c) => (
          <CampaignListCard
            key={String(c.id)}
            campaign={c as never}
            onPress={() => router.push(`/(app)/campaigns/${c.id}`)}
          />
        ))
      )}

      {/* Pull-to-refresh affordance via refetch button for nested-scroll safety */}
      <Button title="Refresh" variant="ghost" onPress={() => query.refetch()} loading={query.isFetching} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1 },
});
