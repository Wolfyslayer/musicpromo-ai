import { useCallback } from "react";
import { View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Share2 } from "lucide-react-native";
import { useAuth, useWorkspaceRefresh } from "@/lib/AuthContext";
import { loadCampaign } from "@/services/data";
import { campaignProgress } from "@/services/format";
import { ErrorState, Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { ProgressBar, Tabs } from "@/components/ui/controls";
import { Text } from "@/components/ui/text";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import CampaignPlan from "@/components/campaign/CampaignPlan";
import ContentLibrary from "@/components/campaign/ContentLibrary";
import SongAnalysis from "@/components/campaign/SongAnalysis";
import CampaignVideos from "@/components/campaign/CampaignVideos";
import CampaignAnalytics from "@/components/campaign/CampaignAnalytics";

const TAB_ITEMS = [
  { value: "plan", label: "Plan" },
  { value: "content", label: "Content" },
  { value: "videos", label: "Videos" },
  { value: "analytics", label: "Analytics" },
];

export default function CampaignDetail() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const tab = (Array.isArray(params.tab) ? params.tab[0] : params.tab) || "plan";
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["campaign", id, user?.id],
    queryFn: () => loadCampaign(id),
    enabled: Boolean(id),
  });
  const { refetch } = query;
  const reload = useCallback(() => {
    refetch();
  }, [refetch]);
  useWorkspaceRefresh(reload);

  const header = <Stack.Screen options={{ title: query.data?.song?.title || "Campaign" }} />;

  if (query.isError) {
    return (
      <Screen>
        {header}
        <ErrorState message={query.error?.message} onRetry={reload} />
      </Screen>
    );
  }
  if (!query.data) {
    return (
      <Screen>
        {header}
        <View className="h-64 rounded-2xl bg-muted/40" />
      </Screen>
    );
  }

  const { campaign, song, artist, days, analytics, videos, content } = query.data;
  const progress = campaignProgress(days);
  const songWithArtist = { ...song, artistName: artist?.name };

  return (
    <Screen refreshing={query.isRefetching} onRefresh={reload} contentClassName="gap-6">
      {header}

      <View className="overflow-hidden rounded-3xl border border-border/60 bg-card p-5">
        <View className="flex-row gap-4">
          <ArtworkImage src={song?.artwork_url} className="h-28 w-28" rounded="rounded-2xl" />
          <View className="min-w-0 flex-1">
            <StatusBadge status={campaign.status} />
            <Text className="mt-2 font-heading text-2xl" numberOfLines={1}>
              {song?.title || "Untitled"}
            </Text>
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {artist?.name} · {fmtRange(campaign)}
            </Text>
          </View>
        </View>
        {campaign.summary ? (
          <Text className="mt-3 text-sm text-muted-foreground" numberOfLines={2}>
            {campaign.summary}
          </Text>
        ) : null}
        <View className="mt-3">
          <ProgressBar value={progress} showLabel />
        </View>
        <View className="mt-3 flex-row flex-wrap gap-2">
          <Button size="sm" icon={LayoutGrid} className="rounded-full" onPress={() => router.push(`/campaigns/${id}/content`)}>
            Content Workspace
          </Button>
          <Button size="sm" variant="outline" icon={Share2} className="rounded-full" onPress={() => router.push("/social")}>
            Social
          </Button>
        </View>
      </View>

      {song ? <SongAnalysis song={songWithArtist} onRefresh={reload} /> : null}

      <View className="gap-5">
        <Tabs value={tab} onValueChange={(v) => router.setParams({ tab: v })} items={TAB_ITEMS} />

        {tab === "plan" ? <CampaignPlan campaign={campaign} days={days} song={songWithArtist} onRefresh={reload} /> : null}
        {tab === "content" ? (
          <View className="gap-4">
            <View className="gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3">
              <Text className="text-sm text-muted-foreground">
                Generate AI assets here, or open the Content Workspace to browse by campaign day.
              </Text>
              <Button
                size="sm"
                variant="outline"
                icon={LayoutGrid}
                className="self-start rounded-full"
                onPress={() => router.push(`/campaigns/${id}/content`)}
              >
                Open Workspace
              </Button>
            </View>
            <ContentLibrary campaign={campaign} song={songWithArtist} content={content} onRefresh={reload} />
          </View>
        ) : null}
        {tab === "videos" ? <CampaignVideos campaign={campaign} videos={videos} song={song} /> : null}
        {tab === "analytics" ? (
          <CampaignAnalytics campaign={campaign} analytics={analytics} days={days} onRefresh={reload} />
        ) : null}
      </View>
    </Screen>
  );
}

function fmtRange(c) {
  return `${c.start_date || ""} → ${c.end_date || ""}`;
}
