import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Linking, View } from "react-native";
import { Button, Card, Empty, Muted, P, Screen } from "@/components/ui";
import { errorMessage } from "@/lib/format";
import { selectCampaignVideos } from "@/lib/social";
import type { Row } from "@/lib/types";

export default function CampaignVideo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [videos, setVideos] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    selectCampaignVideos(String(id))
      .then(setVideos)
      .catch((err) => {
        setVideos([]);
        setError(errorMessage(err));
      });
  }, [id]);

  return (
    <Screen>
      <View className="gap-4">
        <Card className="gap-2">
          <P className="font-semibold">Video studio</P>
          <Muted>
            On-device Remotion rendering and lyrics sync are not in this build. Videos rendered on the web show up here when they are saved to the campaign.
          </Muted>
        </Card>
        {error ? <Muted>{error}</Muted> : null}
        {videos?.length ? (
          videos.map((video) => (
            <Card key={video.id} className="gap-2">
              <P className="font-semibold">{video.title || "Promo video"}</P>
              <Muted>
                {video.rendering_status || "saved"} · {video.duration || 15}s
              </Muted>
              {video.render_output_url ? (
                <Button label="Open video" variant="outline" onPress={() => Linking.openURL(video.render_output_url)} />
              ) : null}
            </Card>
          ))
        ) : videos ? (
          <Empty title="No videos yet" description="Render a promo on the web studio, then reopen this campaign." />
        ) : null}
      </View>
    </Screen>
  );
}