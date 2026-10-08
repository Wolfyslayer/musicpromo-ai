import { StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingBlock } from "@/components/ui/LoadingBlock";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { VideoPreviewPlayer } from "@/components/VideoPreviewPlayer";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { loadCampaign } from "@/services/data";
import { spacing } from "@/theme";
import { userFacingError } from "@/lib/errors";
import { fmtDuration } from "@/services/format";

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => loadCampaign(String(id)),
    enabled: Boolean(id),
  });

  const song = query.data?.song as
    | { title?: string; audio_url?: string; artwork_url?: string }
    | null
    | undefined;
  const campaign = query.data?.campaign;
  const audioUrl = song?.audio_url || "";
  const player = useAudioPlayer(audioUrl || null);

  const readyVideo = (query.data?.videos || []).find(
    (v) =>
      v.rendering_status === "complete" &&
      v.render_output_url &&
      /^https:\/\//i.test(String(v.render_output_url))
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: String(song?.title || campaign?.name || "Campaign"),
        }}
      />
      <Screen>
        <OfflineBanner />
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? (
          <ErrorBanner
            message={userFacingError(query.error, "Could not load campaign.")}
            onRetry={() => query.refetch()}
          />
        ) : null}

        {query.data ? (
          <>
            <Card>
              <Text muted variant="caption">
                Status · {String(campaign?.status || "—")}
              </Text>
              <Text variant="heading">
                {String(song?.title || campaign?.name || "Untitled")}
              </Text>
              <Text muted>
                {(query.data.artist as { name?: string } | null)?.name || "Unknown artist"} ·{" "}
                {query.data.days.length} plan days · {query.data.videos.length} videos
              </Text>
            </Card>

            {audioUrl ? (
              <Card>
                <Text variant="label">Track preview</Text>
                <Text muted variant="caption">
                  {player.durationMs ? fmtDuration(player.durationMs / 1000) : "Audio"}
                  {player.isPlaying ? " · playing" : ""}
                </Text>
                <View style={styles.row}>
                  <Button
                    title={player.isPlaying ? "Pause" : "Play"}
                    onPress={player.toggle}
                    loading={player.loading}
                  />
                  <Button
                    title="Seek start"
                    variant="outline"
                    onPress={() => player.seek(0)}
                  />
                </View>
                {player.error ? <ErrorBanner message={player.error} /> : null}
              </Card>
            ) : null}

            <Text variant="heading">Plan days</Text>
            {query.data.days.length ? (
              query.data.days.slice(0, 14).map((day) => (
                <Card key={String(day.id)}>
                  <Text variant="bodyStrong">
                    Day {String(day.day_number ?? "—")} · {String(day.status || "planned")}
                  </Text>
                  <Text muted numberOfLines={3}>
                    {String(day.caption || day.hook || day.title || "No copy yet")}
                  </Text>
                </Card>
              ))
            ) : (
              <Text muted>
                No plan days yet. Generate the plan from the web Release Campaign planner (AI Edge
                Function) — not silently dropped.
              </Text>
            )}

            <Text variant="heading">Video</Text>
            <VideoPreviewPlayer
              url={readyVideo ? String(readyVideo.render_output_url) : null}
              statusLabel={
                readyVideo
                  ? "Exported MP4 ready"
                  : query.data.videos.length
                    ? `Projects: ${query.data.videos.length} (export on web Remotion studio)`
                    : "No video projects yet"
              }
            />
            <Button title="Open video studio" variant="secondary" onPress={() => router.push("/(app)/video")} />

            <Button title="Refresh" variant="ghost" onPress={() => query.refetch()} />
          </>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
});
