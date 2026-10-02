import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Artwork, Badge, Button, Card, Muted, P, Progress, Screen } from "@/components/ui";
import { loadCampaign } from "@/lib/data";
import { campaignProgress, errorMessage, fmtDate } from "@/lib/format";
import { db } from "@/lib/db";
import { useToast } from "@/components/Toast";
import type { Row } from "@/lib/types";

const TABS = ["plan", "content", "videos", "analytics"] as const;

export default function CampaignDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
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

  const markComplete = async (day: Row) => {
    await db.entities.CampaignDay.update(day.id, { status: day.status === "complete" ? "planned" : "complete" });
    toast({ title: "Day updated" });
    reload();
  };

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
        {tab === "plan" &&
          (days || []).map((day: Row) => (
            <Card key={day.id} className="gap-2">
              <View className="flex-row items-center justify-between">
                <P className="font-semibold">
                  Day {day.day_number} · {day.platform}
                </P>
                <Badge status={day.status} />
              </View>
              <Muted>
                {fmtDate(day.date)} · {day.content_type}
              </Muted>
              <P>{day.hook || day.caption || day.objective || "No copy yet"}</P>
              <Button label="Compose" variant="outline" onPress={() => router.push({ pathname: "/social/compose", params: { campaign: String(id), day: day.id } })} />
              <Button label={day.status === "complete" ? "Mark planned" : "Mark complete"} variant="ghost" onPress={() => markComplete(day)} />
            </Card>
          ))}
        {tab === "content" &&
          (content || []).map((item: Row) => (
            <Card key={item.id}>
              <P className="font-semibold">{item.content_type || item.type || "Content"}</P>
              <Muted>{item.caption || item.text || item.body || "Saved content"}</Muted>
            </Card>
          ))}
        {tab === "videos" &&
          (videos || []).map((video: Row) => (
            <Card key={video.id}>
              <P className="font-semibold">{video.title || "Promo video"}</P>
              <Muted>{video.rendering_status || "saved"}</Muted>
            </Card>
          ))}
        {tab === "analytics" && (
          <Card>
            <Muted>{(analytics || []).length} saved metric rows for this campaign.</Muted>
          </Card>
        )}
        {!days?.length && tab === "plan" ? <Muted>This campaign has no days yet.</Muted> : null}
      </View>
    </Screen>
  );
}
