import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/LoadingBlock";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { GuestBanner } from "@/components/GuestBanner";
import { CampaignListCard } from "@/components/CampaignListCard";
import { deleteCampaign, loadCampaigns } from "@/services/data";
import { CAMPAIGN_STATUSES } from "@/services/constants";
import { spacing } from "@/theme";
import { userFacingError } from "@/lib/errors";
import { useAuth } from "@/auth/AuthContext";

export default function CampaignsScreen() {
  const { isAuthenticated, requireAuth } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const query = useQuery({
    queryKey: ["campaigns"],
    queryFn: loadCampaigns,
    enabled: isAuthenticated,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const filtered = useMemo(() => {
    return (query.data || []).filter((c) => {
      const title = String((c.song as { title?: string } | undefined)?.title || c.name || "");
      const artist = String((c.artist as { name?: string } | undefined)?.name || "");
      const matchQ =
        !q ||
        title.toLowerCase().includes(q.toLowerCase()) ||
        artist.toLowerCase().includes(q.toLowerCase());
      const matchStatus = status === "all" || c.status === status;
      return matchQ && matchStatus;
    });
  }, [query.data, q, status]);

  return (
    <Screen>
      <OfflineBanner />
      <GuestBanner />
      <View style={styles.header}>
        <Text variant="heading">Campaigns</Text>
        <Button
          title="New"
          onPress={() => requireAuth(() => router.push("/(app)/campaigns/create"))}
        />
      </View>

      {!isAuthenticated ? (
        <EmptyState
          title="Sign in to view campaigns"
          description="Browse other tabs freely. Your campaign library needs an account."
          actionLabel="Sign in"
          onAction={() => router.push("/(auth)/login")}
        />
      ) : (
        <>
          <Input
            label="Search"
            value={q}
            onChangeText={setQ}
            placeholder="Song or artist"
            accessibilityHint="Filter campaigns"
          />
          <View style={styles.filters}>
            <Button
              title="All"
              variant={status === "all" ? "primary" : "outline"}
              onPress={() => setStatus("all")}
              style={styles.chip}
            />
            {CAMPAIGN_STATUSES.slice(0, 4).map((s) => (
              <Button
                key={s.id}
                title={s.label}
                variant={status === s.id ? "primary" : "outline"}
                onPress={() => setStatus(s.id)}
                style={styles.chip}
              />
            ))}
          </View>

          {query.isLoading ? <LoadingBlock /> : null}
          {query.isError ? (
            <ErrorBanner
              message={userFacingError(query.error, "Could not load campaigns.")}
              onRetry={() => query.refetch()}
            />
          ) : null}
          {remove.isError ? (
            <ErrorBanner
              message={userFacingError(remove.error, "Could not delete campaign.")}
              onRetry={() => remove.reset()}
            />
          ) : null}

          {query.isSuccess && !filtered.length ? (
            <EmptyState
              title="No campaigns found"
              description="Try a different search or create a new promo."
              actionLabel="New promo"
              onAction={() => requireAuth(() => router.push("/(app)/campaigns/create"))}
            />
          ) : (
            filtered.map((c) => (
              <View key={String(c.id)} style={{ gap: spacing.sm }}>
                <CampaignListCard
                  campaign={c as never}
                  onPress={() => router.push(`/(app)/campaigns/${c.id}`)}
                />
                <Button
                  title="Delete"
                  variant="destructive"
                  onPress={() => requireAuth(() => remove.mutate(String(c.id)))}
                  loading={remove.isPending && remove.variables === c.id}
                  disabled={remove.isPending}
                />
              </View>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md },
});
