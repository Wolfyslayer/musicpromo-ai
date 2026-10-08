import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/LoadingBlock";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { GuestBanner } from "@/components/GuestBanner";
import { loadAnalyticsSummary } from "@/services/data";
import { useAppTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme";
import { userFacingError } from "@/lib/errors";
import { useAuth } from "@/auth/AuthContext";

export default function AnalyticsScreen() {
  const { colors } = useAppTheme();
  const { isAuthenticated } = useAuth();
  const query = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: loadAnalyticsSummary,
    enabled: isAuthenticated,
  });

  return (
    <Screen>
      <OfflineBanner />
      <GuestBanner />
      <Text variant="heading">Analytics</Text>
      <Text muted>High-level totals from your analytics entries and campaigns.</Text>

      {!isAuthenticated ? (
        <EmptyState
          title="Sign in for analytics"
          description="Totals load from your AnalyticsEntry rows after login."
          actionLabel="Sign in"
          onAction={() => router.push("/(auth)/login")}
        />
      ) : (
        <>
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
          <Button
            title="Refresh"
            variant="outline"
            onPress={() => query.refetch()}
            loading={query.isFetching}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.md },
  stat: { gap: spacing.xs },
});
