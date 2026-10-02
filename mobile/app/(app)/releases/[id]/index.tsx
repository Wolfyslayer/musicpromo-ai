import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { Artwork, Badge, Button, Card, Muted, P, Screen } from "@/components/ui";
import { loadRelease } from "@/lib/data";
import { daysUntil, errorMessage, fmtDate } from "@/lib/format";
import type { Row } from "@/lib/types";

export default function ReleaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRelease(String(id))
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  if (!data) {
    return (
      <Screen>
        <Muted>{error || "Loading release…"}</Muted>
      </Screen>
    );
  }

  const countdown = daysUntil(data.release.release_date);

  return (
    <Screen>
      <View className="gap-4">
        <Card className="gap-3">
          <View className="flex-row gap-3">
            <Artwork uri={data.release.artwork_url} size={88} />
            <View className="flex-1 gap-1">
              <Badge status={data.release.status} />
              <P className="font-heading text-xl">{data.release.title}</P>
              <Muted>{data.artist?.name}</Muted>
              <Muted>
                {fmtDate(data.release.release_date)}
                {countdown != null ? ` · ${countdown >= 0 ? `${countdown} days to go` : "released"}` : ""}
              </Muted>
            </View>
          </View>
          {data.release.description ? <Muted>{data.release.description}</Muted> : null}
          <Button label="Edit" variant="outline" onPress={() => router.push(`/releases/${id}/edit`)} />
          <Button label="Calendar" variant="outline" onPress={() => router.push(`/releases/${id}/calendar`)} />
          <Button label="Content" variant="outline" onPress={() => router.push(`/releases/${id}/content`)} />
        </Card>
        <P className="font-semibold">Songs</P>
        {(data.songs || []).map((song: Row) => (
          <Card key={song.id}>
            <P>{song.title}</P>
            <Muted>{song.genre}</Muted>
          </Card>
        ))}
        <P className="font-semibold">Campaigns</P>
        {(data.campaigns || []).map((campaign: Row) => (
          <Card key={campaign.id} className="gap-2">
            <P>{campaign.name || campaign.song?.title || "Campaign"}</P>
            <Badge status={campaign.status} />
            <Button label="Open campaign" variant="ghost" onPress={() => router.push(`/campaigns/${campaign.id}`)} />
          </Card>
        ))}
      </View>
    </Screen>
  );
}
