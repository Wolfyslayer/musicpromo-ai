import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, ListChecks, Share2 } from "lucide-react-native";
import { loadCampaignContent } from "@/services/data";
import { useAuth, useWorkspaceRefresh } from "@/lib/AuthContext";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import ContentWorkspace from "@/components/campaign/ContentWorkspace";

export default function CampaignContent() {
  const { id, day } = useLocalSearchParams();
  const focusDayId = day || null;
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["campaign-content", id, user?.id],
    queryFn: () => loadCampaignContent(id),
    enabled: Boolean(id),
  });
  const { refetch } = query;
  const reload = useCallback(() => refetch(), [refetch]);
  useWorkspaceRefresh(reload);

  const data = query.data;
  const error = query.isError ? query.error?.message || "Failed to load content" : "";

  if (error) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Content" }} />
        <BackLink label="Back to campaigns" onPress={() => router.push("/campaigns")} />
        <Text className="text-destructive">{error}</Text>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Content" }} />
        <View className="h-64 rounded-2xl bg-muted/40" />
      </Screen>
    );
  }

  const { campaign, song, artist, release, days, content, videos } = data;

  return (
    <Screen refreshing={query.isRefetching} onRefresh={reload}>
      <Stack.Screen options={{ title: song?.title || campaign.name || "Campaign Content" }} />
      <BackLink label="Back to Campaign" onPress={() => router.push(`/campaigns/${id}`)} />

      <View className="overflow-hidden rounded-3xl border border-border/60 bg-card p-5">
        <View className="flex-row gap-4">
          <ArtworkImage src={release?.artwork_url || song?.artwork_url} className="h-28 w-28" rounded="rounded-2xl" />
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <StatusBadge status={campaign.status || "draft"} />
              <View className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5">
                <Text className="text-[10px] uppercase tracking-wider text-muted-foreground">Content Workspace</Text>
              </View>
            </View>
            <Text className="mt-2 font-heading text-2xl" numberOfLines={1}>
              {song?.title || campaign.name || "Campaign Content"}
            </Text>
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {artist?.name || "Unknown artist"}
              {release?.title ? ` · ${release.title}` : ""}
            </Text>
          </View>
        </View>
        <View className="mt-4 flex-row flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={ListChecks}
            className="rounded-full"
            onPress={() => router.push(`/campaigns/${id}?tab=plan`)}
          >
            Plan
          </Button>
          {campaign.release_id ? (
            <Button
              variant="outline"
              size="sm"
              icon={CalendarDays}
              className="rounded-full"
              onPress={() => router.push(`/releases/${campaign.release_id}/calendar`)}
            >
              Calendar
            </Button>
          ) : null}
          <Button variant="outline" size="sm" icon={Share2} className="rounded-full" onPress={() => router.push("/social")}>
            Social
          </Button>
        </View>
      </View>

      <ContentWorkspace
        campaign={campaign}
        song={song}
        artist={artist}
        release={release}
        days={days}
        content={content}
        videos={videos}
        onRefresh={reload}
        focusDayId={focusDayId}
        embedLibrary
      />
    </Screen>
  );
}

function BackLink({ label, onPress }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-1.5 self-start active:opacity-70">
      <Icon as={ArrowLeft} size={16} className="text-muted-foreground" />
      <Text className="text-sm text-muted-foreground">{label}</Text>
    </Pressable>
  );
}
