import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useToast } from "@/components/Toast";
import { Button, Card, Muted, P, Screen } from "@/components/ui";
import { aiService } from "@/lib/ai";
import { loadCampaignContent } from "@/lib/data";
import { db } from "@/lib/db";
import { errorMessage, fmtDate } from "@/lib/format";
import type { Row } from "@/lib/types";

export default function CampaignContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toast } = useToast();
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = () => {
    loadCampaignContent(String(id))
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  };

  useEffect(() => {
    reload();
  }, [id]);

  const generate = async () => {
    if (!data?.song) return;
    setBusy(true);
    try {
      const result = await aiService.generateCaptions({
        song: { ...data.song, artistName: data.artist?.name },
        analysis: data.song.analysis,
        platform: data.days?.[0]?.platform,
      });
      await db.entities.GeneratedContent.create({
        campaign_id: id,
        content_type: "caption",
        caption: JSON.stringify(result),
        is_demo: false,
      });
      toast({ title: "Captions saved" });
      reload();
    } catch (err) {
      toast({ title: "Generation failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View className="gap-4">
        {error ? <Muted>{error}</Muted> : null}
        <Card className="gap-2">
          <P className="font-semibold">{data?.song?.title || data?.campaign?.name || "Content"}</P>
          <Muted>{data?.artist?.name}</Muted>
          <Button label="Generate captions" onPress={generate} loading={busy} />
        </Card>
        {(data?.days || []).map((day: Row) => (
          <Card key={day.id} className="gap-1">
            <P className="font-semibold">
              Day {day.day_number} · {day.platform}
            </P>
            <Muted>{fmtDate(day.date)}</Muted>
            <P>{day.caption || day.hook || "No caption"}</P>
          </Card>
        ))}
        {(data?.content || []).map((item: Row) => (
          <Card key={item.id}>
            <Muted>{item.content_type || "Generated"}</Muted>
            <P>{item.caption || item.text || "Saved item"}</P>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
