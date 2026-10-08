import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/LoadingBlock";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { VideoPreviewPlayer } from "@/components/VideoPreviewPlayer";
import { OfflineBanner } from "@/components/OfflineBanner";
import { db } from "@/api/base44Client";
import { spacing } from "@/theme";
import { userFacingError } from "@/lib/errors";

/**
 * Video studio (native): list VideoProject entities + preview exported MP4s.
 * Remotion/WebCodecs encode remains on web — documented in MOBILE_MIGRATION_PLAN.md Phase 11.
 */
export default function VideoStudioScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["video-projects"],
    queryFn: () => db.entities.VideoProject.list("-created_date", 100),
  });

  const selected = useMemo(
    () => (query.data || []).find((v) => v.id === selectedId) || (query.data || [])[0],
    [query.data, selectedId]
  );

  const exportUrl =
    selected?.render_output_url && /^https:\/\//i.test(String(selected.render_output_url))
      ? String(selected.render_output_url)
      : null;

  return (
    <>
      <Stack.Screen options={{ title: "Video studio" }} />
      <Screen>
        <OfflineBanner />
        <Text variant="heading">Promo videos</Text>
        <Card>
          <Text variant="label">Export architecture</Text>
          <Text muted variant="caption">
            Preview is native. MP4 encode uses Remotion + WebCodecs in the web app (or a future
            backend/FFmpeg job). This screen does not invent fake MP4s. Incomplete renderer features
            stay on web.
          </Text>
        </Card>

        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? (
          <ErrorBanner
            message={userFacingError(query.error, "Could not load video projects.")}
            onRetry={() => query.refetch()}
          />
        ) : null}

        {query.isSuccess && !(query.data || []).length ? (
          <EmptyState
            title="No video projects"
            description="Create or export videos from a campaign on web, then preview the HTTPS output here."
          />
        ) : (
          <View style={styles.list}>
            {(query.data || []).map((v) => (
              <Button
                key={String(v.id)}
                title={`${String(v.name || v.template || "Project")} · ${String(v.rendering_status || "draft")}`}
                variant={selected?.id === v.id ? "primary" : "outline"}
                onPress={() => setSelectedId(String(v.id))}
              />
            ))}
          </View>
        )}

        {selected ? (
          <>
            <Text variant="heading">Preview</Text>
            <VideoPreviewPlayer
              url={exportUrl}
              statusLabel={`Status: ${String(selected.rendering_status || "unknown")}`}
            />
            <Text muted variant="caption">
              Save/export state is read from VideoProject.rendering_status + render_output_url.
            </Text>
          </>
        ) : null}

        <Button title="Refresh" variant="ghost" onPress={() => query.refetch()} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
});
