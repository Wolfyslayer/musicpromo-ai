import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { CampaignAnalyticsPanel } from "@/components/CampaignAnalyticsPanel";
import { CampaignPlan } from "@/components/CampaignPlan";
import { Artwork, Badge, Button, Card, Muted, P, Progress, Screen } from "@/components/ui";
import { loadCampaign } from "@/lib/data";
import { campaignProgress, errorMessage, fmtDate } from "@/lib/format";
import type { Row } from "@/lib/types";

const TABS = ["plan", "content", "videos", "analytics"] as const;

export default function CampaignDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("plan");

  const reload = useCallback(() => {
    if (!id) return;
    loadCampaign(String(id))
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (error) {
    return (
      <Screen>
        <Muted>{error}</Muted>
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen>
        <Muted>Loading campaign…</Muted>
      </Screen>
    );
  }

  const { campaign, song, artist, days, analytics, videos, content } = data;
  const progress = campaignProgress(days);

  return (
    <Screen>
      <View className="gap-4">
        <Card className="gap-3">
          <View className="flex-row gap-3">
            <Artwork uri={song?.artwork_url} size={88} />
            <View className="flex-1 gap-1">
              <Badge status={campaign.status} />
              <P className="font-heading text-xl">{song?.title || campaign.name || "Untitled"}</P>
              <Muted>
                {artist?.name || "Artist"} · {fmtDate(campaign.start_date)} – {fmtDate(campaign.end_date)}
              </Muted>
            </View>
          </View>
          {campaign.summary ? <Muted>{campaign.summary}</Muted> : null}
          <Progress value={progress} />
          <Muted>{progress}% of days complete</Muted>
          <Button label="Content workspace" onPress={() => router.push(`/campaigns/${id}/content`)} />
          <Button label="Videos" variant="outline" onPress={() => router.push(`/campaigns/${id}/video`)} />
        </Card>
        <View className="flex-row flex-wrap gap-2">
          {TABS.map((item) => (
            <Pressable key={item} onPress={() => setTab(item)} className={`rounded-full px-3 py-2 ${tab === item ? "bg-primary" : "bg-muted"}`}>
              <P className={tab === item ? "text-white" : ""}>{item}</P>
            </Pressable>
          ))}
        </View>
        {tab === "plan" ? <CampaignPlan campaign={campaign} song={song} days={days || []} onRefresh={reload} /> : null}
        {tab === "content" &&
          (content || []).map((item: Row) => (
            <Card key={item.id}>
              <P className="font-semibold">{item.content_type || item.type || "Content"}</P>
              <Muted>{item.caption || item.text || item.body || item.content || "Saved content"}</Muted>
            </Card>
          ))}
        {tab === "videos" &&
          (videos || []).map((video: Row) => (
            <Card key={video.id} className="gap-2">
              <P className="font-semibold">{video.title || "Promo video"}</P>
              <Muted>{video.rendering_status || "saved"}</Muted>
              <Button label="Open editor" variant="outline" onPress={() => router.push({ pathname: `/campaigns/${id}/video`, params: { project: video.id } })} />
            </Card>
          ))}
        {tab === "analytics" ? <CampaignAnalyticsPanel campaign={campaign} analytics={analytics || []} days={days || []} onRefresh={reload} /> : null}
      </View>
    </Screen>
  );
}
