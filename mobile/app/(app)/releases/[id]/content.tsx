import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { Button, Card, Muted, P, Screen } from "@/components/ui";
import { loadReleaseContent } from "@/lib/data";
import { errorMessage } from "@/lib/format";
import type { Row } from "@/lib/types";

export default function ReleaseContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadReleaseContent(String(id))
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  return (
    <Screen>
      <View className="gap-4">
        <P className="font-semibold">{data?.release?.title || "Release content"}</P>
        <Muted>{data?.artist?.name}</Muted>
        {error ? <Muted>{error}</Muted> : null}
        {(data?.campaigns || []).map((bundle: Row) => (
          <Card key={bundle.campaign.id} className="gap-2">
            <P className="font-semibold">{bundle.campaign.name || bundle.song?.title || "Campaign"}</P>
            <Muted>
              {(bundle.days || []).length} days · {(bundle.content || []).length} generated items
            </Muted>
            {(bundle.days || []).slice(0, 3).map((day: Row) => (
              <Muted key={day.id}>
                Day {day.day_number}: {day.caption || day.hook || day.platform}
              </Muted>
            ))}
            <Button label="Open campaign" variant="outline" onPress={() => router.push(`/campaigns/${bundle.campaign.id}/content`)} />
          </Card>
        ))}
      </View>
    </Screen>
  );
}
