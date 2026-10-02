import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { ConfigBanner } from "@/components/ConfigBanner";
import { useAuth } from "@/components/AuthProvider";
import { Artwork, Badge, Button, Card, Empty, ErrorText, H1, Muted, P, Progress, Screen } from "@/components/ui";
import { loadCampaigns } from "@/lib/data";
import { errorMessage } from "@/lib/format";
import { selectCampaignVideos } from "@/lib/social";
import type { Row } from "@/lib/types";

export default function Dashboard() {
  const router = useRouter();
  const { isAuthenticated, refreshKey } = useAuth();
  const [campaigns, setCampaigns] = useState<Row[] | null>(null);
  const [readyCount, setReadyCount] = useState(0);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setError("");
    loadCampaigns()
      .then(async (rows) => {
        setCampaigns(rows);
        const active = rows.find((row) => ["active", "scheduled", "preparing"].includes(row.status));
        if (!active?.id) {
          setReadyCount(0);
          return;
        }
        const videos = await selectCampaignVideos(active.id).catch(() => []);
        setReadyCount(videos.filter((video) => video.rendering_status === "complete" && video.render_output_url).length);
      })
      .catch((err) => {
        setCampaigns([]);
        setError(isAuthenticated ? errorMessage(err, "Could not load campaigns.") : "");
      });
  }, [isAuthenticated]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  const active = (campaigns || []).find((row) => ["active", "scheduled", "preparing"].includes(row.status));
  const recent = (campaigns || []).slice(0, 6);

  return (
    <Screen>
      <View className="gap-6">
        <ConfigBanner />
        <View className="gap-2">
          <H1>MusicPromo AI</H1>
          <Muted>Hands-off promo: scheduled publishing and live analytics. Video rendering stays on the web studio.</Muted>
          <View className="mt-2">
            <Button label="New Campaign" onPress={() => router.push("/create")} />
          </View>
        </View>
        <ErrorText>{error}</ErrorText>
        {active ? (
          <Pressable onPress={() => router.push(`/campaigns/${active.id}`)}>
            <Card className="gap-3">
              <View className="flex-row gap-3">
                <Artwork uri={active.song?.artwork_url} />
                <View className="flex-1 gap-1">
                  <Badge status={active.status} />
                  <P className="font-semibold">{active.song?.title || active.name || "Untitled"}</P>
                  <Muted>{active.artist?.name || "Artist"}</Muted>
                </View>
              </View>
              <View className="flex-row justify-between">
                <Muted>Campaign progress</Muted>
                <Muted>{active.progressValue || 0}%</Muted>
              </View>
              <Progress value={active.progressValue || 0} />
              <Muted>
                {readyCount} ready videos · {active.daysCount || 0} posts
              </Muted>
            </Card>
          </Pressable>
        ) : campaigns ? (
          <Empty title="No active campaign" description="Create one to start a rollout." />
        ) : null}
        <View className="flex-row flex-wrap gap-3">
          {[
            { label: "Campaigns", href: "/campaigns" as const },
            { label: "Analytics", href: "/analytics" as const },
            { label: "Social", href: "/social" as const },
            { label: "Artists", href: "/artists" as const },
          ].map((item) => (
            <Pressable key={item.label} onPress={() => router.push(item.href)} className="min-w-[46%] flex-1">
              <Card>
                <P className="font-semibold">{item.label}</P>
              </Card>
            </Pressable>
          ))}
        </View>
        <View className="gap-3">
          <P className="font-semibold">Recent campaigns</P>
          {recent.length ? (
            recent.map((campaign) => (
              <Pressable key={campaign.id} onPress={() => router.push(`/campaigns/${campaign.id}`)}>
                <Card className="flex-row items-center gap-3">
                  <Artwork uri={campaign.song?.artwork_url} size={56} />
                  <View className="flex-1">
                    <P className="font-semibold">{campaign.song?.title || campaign.name}</P>
                    <Muted>{campaign.artist?.name}</Muted>
                  </View>
                  <Badge status={campaign.status} />
                </Card>
              </Pressable>
            ))
          ) : campaigns ? (
            <Empty title="No campaigns yet" description="Sign in and create your first campaign." />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
