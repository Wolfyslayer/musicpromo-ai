import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/LoadingBlock";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { loadAnalyticsSummary } from "@/services/data";
import { useAppTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme";
import { userFacingError } from "@/lib/errors";

export default function AnalyticsScreen() {
  const { colors } = useAppTheme();
  const query = useQuery({ queryKey: ["analytics-summary"], queryFn: loadAnalyticsSummary });

  return (
    <Screen>
      <OfflineBanner />
      <Text variant="heading">Analytics</Text>
      <Text muted>High-level totals from your analytics entries and campaigns.</Text>

      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? (
        <ErrorBanner
          message={userFacingError(query.error, "Could not load analytics.")}
          onRetry={() => query.refetch()}
        />
      ) : null}

      {query.data ? (
        <View style={styles.grid}>
          <Card style={styles.stat}>
            <Text muted variant="caption">
              Campaigns
            </Text>
            <Text variant="display">{String(query.data.campaignCount)}</Text>
          </Card>
          <Card style={styles.stat}>
            <Text muted variant="caption">
              Active
            </Text>
            <Text variant="display" color={colors.primary}>
              {String(query.data.activeCount)}
            </Text>
          </Card>
          <Card style={styles.stat}>
            <Text muted variant="caption">
              Recorded views/plays
            </Text>
            <Text variant="display">{String(query.data.totalViews)}</Text>
          </Card>
        </View>
      ) : null}

      <Text muted variant="caption">
        Deep social charts remain on web (Recharts). Mobile shows live totals from the same
        AnalyticsEntry entities — no mock metrics.
      </Text>
      <Button title="Refresh" variant="outline" onPress={() => query.refetch()} loading={query.isFetching} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.md },
  stat: { gap: spacing.xs },
});
