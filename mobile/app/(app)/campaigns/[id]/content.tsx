import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { ContentLibrary } from "@/components/ContentLibrary";
import { Muted, Screen } from "@/components/ui";
import { loadCampaignContent } from "@/lib/data";
import { errorMessage } from "@/lib/format";
import type { Row } from "@/lib/types";

export default function CampaignContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState("");

  const reload = () => {
    loadCampaignContent(String(id))
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  };

  useEffect(() => {
    reload();
  }, [id]);

  return (
    <Screen>
      <View className="gap-4">
        {error ? <Muted>{error}</Muted> : null}
        {data ? (
          <ContentLibrary
            campaign={data.campaign}
            song={data.song}
            artist={data.artist}
            release={data.release}
            days={data.days || []}
            content={data.content || []}
            videos={data.videos || []}
            onRefresh={reload}
          />
        ) : (
          <Muted>Loading content…</Muted>
        )}
      </View>
    </Screen>
  );
}
