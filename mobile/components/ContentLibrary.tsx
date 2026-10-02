import { useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { useToast } from "@/components/Toast";
import { Artwork, Button, Card, Chip, Muted, P, SelectField } from "@/components/ui";
import { aiService } from "@/lib/ai";
import { PLATFORMS } from "@/lib/constants";
import { db } from "@/lib/db";
import { errorMessage } from "@/lib/format";
import type { Row } from "@/lib/types";

const FILTERS = ["all", "captions", "hooks", "hashtags", "videos", "artwork", "library"];

export function ContentLibrary({
  campaign,
  song,
  artist,
  release,
  days,
  content,
  videos,
  onRefresh,
}: {
  campaign: Row;
  song: Row | null;
  artist: Row | null;
  release: Row | null;
  days: Row[];
  content: Row[];
  videos: Row[];
  onRefresh: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");
  const [platform, setPlatform] = useState("TikTok");
  const [loading, setLoading] = useState("");
  const artworkUrl = release?.artwork_url || song?.artwork_url || "";
  const songData = { ...song, artistName: artist?.name };

  const createRecords = async (records: Row[]) => {
    if (!records.length) return;
    await db.entities.GeneratedContent.bulkCreate(records);
    onRefresh();
  };

  const run = async (kind: string, work: () => Promise<void>) => {
    setLoading(kind);
    try {
      await work();
    } catch (err) {
      toast({ title: "Generation failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setLoading("");
    }
  };

  const showDays = !["library", "artwork", "videos"].includes(filter);
  const dayMatches = (day: Row) => {
    if (filter === "captions") return Boolean(day.caption);
    if (filter === "hooks") return Boolean(day.hook);
    if (filter === "hashtags") return Boolean(day.hashtags);
    return true;
  };

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Chip key={item} label={item} selected={filter === item} onPress={() => setFilter(item)} />
        ))}
      </View>
      {(filter === "all" || filter === "artwork") && artworkUrl ? (
        <Card className="flex-row items-center gap-3">
          <Artwork uri={String(artworkUrl)} />
          <View className="flex-1">
            <P className="font-semibold">{release?.title || song?.title || "Artwork"}</P>
            <Muted>{artist?.name || "Artist"}</Muted>
          </View>
        </Card>
      ) : null}
      {filter === "artwork" && !artworkUrl ? <Muted>No artwork attached to this campaign yet.</Muted> : null}
      {(filter === "all" || filter === "videos") &&
        videos.map((video) => (
          <Card key={video.id} className="gap-2">
            <P className="font-semibold">{video.title || song?.title || "Video"}</P>
            <Muted>{video.rendering_status || "saved"} · {video.duration || 15}s</Muted>
            <Button label="Open video" variant="outline" onPress={() => router.push({ pathname: `/campaigns/${campaign.id}/video`, params: { project: video.id } })} />
          </Card>
        ))}
      {showDays
        ? days.filter(dayMatches).map((day) => (
            <Card key={day.id} className="gap-1">
              <P className="font-semibold">
                Day {day.day_number} · {day.platform}
              </P>
              {(filter === "all" || filter === "hooks") && day.hook ? <Muted>Hook: {day.hook}</Muted> : null}
              {(filter === "all" || filter === "captions") && day.caption ? <P>{day.caption}</P> : null}
              {(filter === "all" || filter === "hashtags") && day.hashtags ? (
                <Muted>{Array.isArray(day.hashtags) ? day.hashtags.join(" ") : day.hashtags}</Muted>
              ) : null}
              {day.cta ? <Muted>CTA: {day.cta}</Muted> : null}
            </Card>
          ))
        : null}
      {filter === "all" || filter === "library" ? (
        <Card className="gap-3">
          <P className="font-semibold">Content library</P>
          <SelectField label="Platform" value={platform} options={PLATFORMS.map((item) => ({ label: item.label, value: item.id }))} onChange={setPlatform} />
          <Button
            label="Generate hooks"
            loading={loading === "hook"}
            onPress={() =>
              run("hook", async () => {
                const res = await aiService.generateHooks({ song: songData, analysis: song?.analysis, platform });
                await createRecords((res?.hooks || []).map((item: Row) => ({ campaign_id: campaign.id, type: "hook", platform, content: item.text, metadata: item })));
                toast({ title: `${(res?.hooks || []).length} hooks generated` });
              })
            }
          />
          <Button
            label="Generate captions"
            variant="outline"
            loading={loading === "caption"}
            onPress={() =>
              run("caption", async () => {
                const res = await aiService.generateCaptions({ song: songData, analysis: song?.analysis, platform });
                await createRecords((res?.captions || []).map((item: Row) => ({ campaign_id: campaign.id, type: "caption", platform, content: item.text, metadata: item })));
                toast({ title: "Captions generated" });
              })
            }
          />
          <Button
            label="Generate hashtags"
            variant="outline"
            loading={loading === "hashtags"}
            onPress={() =>
              run("hashtags", async () => {
                const res = await aiService.generateHashtags({ song: songData, analysis: song?.analysis, platform });
                await createRecords((res?.categories || []).map((item: Row) => ({ campaign_id: campaign.id, type: "hashtags", platform, content: (item.tags || []).join(" "), metadata: item })));
                toast({ title: "Hashtags generated" });
              })
            }
          />
          <Button
            label="Generate CTAs"
            variant="outline"
            loading={loading === "cta"}
            onPress={() =>
              run("cta", async () => {
                const res = await aiService.generateCTA({ song: songData, analysis: song?.analysis, campaignGoals: campaign.goals });
                await createRecords((res?.ctas || []).map((item: Row) => ({ campaign_id: campaign.id, type: "cta", content: item.text, metadata: item })));
                toast({ title: "CTAs generated" });
              })
            }
          />
          <Button
            label="Generate video concepts"
            variant="outline"
            loading={loading === "video_concept"}
            onPress={() =>
              run("video_concept", async () => {
                const res = await aiService.generateVideoConcepts({ song: songData, analysis: song?.analysis });
                await createRecords((res?.concepts || []).map((item: Row) => ({ campaign_id: campaign.id, type: "video_concept", content: item.description || item.title, metadata: item })));
                toast({ title: "Video concepts generated" });
              })
            }
          />
          {content.map((item) => (
            <View key={item.id} className="gap-1 border-t border-border pt-2">
              <Muted>{item.type || item.content_type || "Saved"}</Muted>
              <P>{item.content || item.caption || item.text || "Saved item"}</P>
              <Button label="Delete" variant="ghost" onPress={() => db.entities.GeneratedContent.delete(item.id).then(onRefresh)} />
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}
