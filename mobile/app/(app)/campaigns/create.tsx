import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { LoadingBlock } from "@/components/ui/LoadingBlock";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ArtworkUploader } from "@/components/ArtworkUploader";
import { AudioUploader } from "@/components/AudioUploader";
import { createCampaignDraft, loadArtists } from "@/services/data";
import { CAMPAIGN_DURATIONS, CAMPAIGN_GOALS } from "@/services/constants";
import { spacing } from "@/theme";
import { userFacingError } from "@/lib/errors";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export default function CreateCampaignScreen() {
  const qc = useQueryClient();
  const { online } = useNetworkStatus();
  const artistsQuery = useQuery({ queryKey: ["artists"], queryFn: loadArtists });

  const [songTitle, setSongTitle] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [artistId, setArtistId] = useState("");
  const [artworkUrl, setArtworkUrl] = useState("");
  const [audio, setAudio] = useState({
    file_uri: "",
    signed_url: "",
    duration: null as number | null,
    name: "",
  });
  const [goal, setGoal] = useState(CAMPAIGN_GOALS[0]);
  const [days, setDays] = useState(14);
  const [formError, setFormError] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createCampaignDraft({
        title: campaignName || `${songTitle} promo`,
        songTitle,
        artistId,
        artworkUrl,
        audioUrl: audio.file_uri,
        audioFilename: audio.name,
        durationSec: audio.duration,
        goals: [goal],
        durationDays: days,
      }),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["campaigns"] });
      router.replace(`/(app)/campaigns/${result.campaign.id}`);
    },
  });

  const submit = () => {
    setFormError("");
    if (!online) {
      setFormError("You’re offline. Reconnect to create a campaign.");
      return;
    }
    if (!songTitle.trim()) {
      setFormError("Song title is required.");
      return;
    }
    if (!artistId) {
      setFormError("Select an artist.");
      return;
    }
    if (create.isPending) return;
    create.mutate();
  };

  return (
    <>
      <Stack.Screen options={{ title: "New promo" }} />
      <Screen>
        <OfflineBanner />
        <Text muted>
          Creates Song + Campaign draft on Supabase. AI plan generation still uses Edge Functions
          (web wizard) when available — this screen never fakes a plan.
        </Text>

        {artistsQuery.isLoading ? <LoadingBlock label="Loading artists…" /> : null}
        {artistsQuery.isError ? (
          <ErrorBanner
            message={userFacingError(artistsQuery.error, "Could not load artists.")}
            onRetry={() => artistsQuery.refetch()}
          />
        ) : null}

        <Input label="Song title" value={songTitle} onChangeText={setSongTitle} />
        <Input
          label="Campaign name (optional)"
          value={campaignName}
          onChangeText={setCampaignName}
        />

        <Text variant="label">Artist</Text>
        <View style={styles.row}>
          {(artistsQuery.data || []).map((a) => (
            <Button
              key={String(a.id)}
              title={String(a.name)}
              variant={artistId === a.id ? "primary" : "outline"}
              onPress={() => setArtistId(String(a.id))}
              style={styles.chip}
            />
          ))}
        </View>
        {!artistsQuery.isLoading && !(artistsQuery.data || []).length ? (
          <Card>
            <Text muted>No artists yet. Add one on the Artists tab first.</Text>
            <Button title="Go to Artists" variant="secondary" onPress={() => router.push("/(app)/(tabs)/artists")} />
          </Card>
        ) : null}

        <Text variant="label">Artwork</Text>
        <ArtworkUploader value={artworkUrl} onChange={({ url }) => setArtworkUrl(url)} />

        <Text variant="label">Audio</Text>
        <AudioUploader value={audio} onChange={setAudio} />

        <Text variant="label">Goal</Text>
        <View style={styles.row}>
          {CAMPAIGN_GOALS.slice(0, 4).map((g) => (
            <Button
              key={g}
              title={g}
              variant={goal === g ? "primary" : "outline"}
              onPress={() => setGoal(g)}
              style={styles.chip}
            />
          ))}
        </View>

        <Text variant="label">Duration</Text>
        <View style={styles.row}>
          {CAMPAIGN_DURATIONS.map((d) => (
            <Button
              key={d.days}
              title={d.label}
              variant={days === d.days ? "primary" : "outline"}
              onPress={() => setDays(d.days)}
              style={styles.chip}
            />
          ))}
        </View>

        {formError ? <ErrorBanner message={formError} /> : null}
        {create.isError ? (
          <ErrorBanner message={userFacingError(create.error, "Could not create campaign.")} />
        ) : null}

        <Button
          title="Create draft campaign"
          onPress={submit}
          loading={create.isPending}
          disabled={create.isPending}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md },
});
