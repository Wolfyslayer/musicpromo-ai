import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Artwork, Badge, Button, Card, Empty, ErrorText, Muted, P, Screen } from "@/components/ui";
import { loadReleases } from "@/lib/data";
import { errorMessage, fmtDate } from "@/lib/format";
import type { Row } from "@/lib/types";

export default function Releases() {
  const router = useRouter();
  const [releases, setReleases] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadReleases()
      .then(setReleases)
      .catch((err) => {
        setError(errorMessage(err, "Failed to load releases"));
        setReleases([]);
      });
  }, []);

  return (
    <Screen>
      <View className="gap-4">
        <Muted>Group songs and campaigns under a release.</Muted>
        <Button label="New release" onPress={() => router.push("/releases/new")} />
        <ErrorText>{error}</ErrorText>
        {releases?.length ? (
          releases.map((release) => (
            <Pressable key={release.id} onPress={() => router.push(`/releases/${release.id}`)}>
              <Card className="flex-row gap-3">
                <Artwork uri={release.artwork_url} size={72} />
                <View className="flex-1 gap-1">
                  <P className="font-semibold">{release.title || "Untitled"}</P>
                  <Muted>{release.artist?.name || "Unknown artist"}</Muted>
                  <Badge status={release.status || "draft"} />
                  <Muted>
                    {fmtDate(release.release_date)} · {release.songsCount || 0} songs · {release.campaignsCount || 0} campaigns
                  </Muted>
                </View>
              </Card>
            </Pressable>
          ))
        ) : releases ? (
          <Empty title="No releases yet" description="Create a release to group songs and campaigns." />
        ) : null}
      </View>
    </Screen>
  );
}
