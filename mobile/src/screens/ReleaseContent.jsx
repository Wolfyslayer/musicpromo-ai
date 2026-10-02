import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Share2, Sparkles } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { loadReleaseContent } from "@/services/data";
import { useAuth, useWorkspaceRefresh } from "@/lib/AuthContext";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import ContentWorkspace from "@/components/campaign/ContentWorkspace";

export default function ReleaseContent() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [activeCampaignId, setActiveCampaignId] = useState(null);
  const query = useQuery({
    queryKey: ["release-content", id, user?.id],
    queryFn: () => loadReleaseContent(id),
    enabled: Boolean(id),
  });
  const { refetch } = query;
  const reload = useCallback(() => refetch(), [refetch]);
  useWorkspaceRefresh(reload);

  const data = query.data;
  const error = query.isError ? query.error?.message || "Failed to load release content" : "";

  if (error) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Release Content" }} />
        <BackLink label="Back to releases" onPress={() => router.push("/releases")} />
        <Text className="text-destructive">{error}</Text>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Release Content" }} />
        <View className="h-64 rounded-2xl bg-muted/40" />
      </Screen>
    );
  }

  const { release, artist, campaigns } = data;
  const active = campaigns.find((c) => c.campaign.id === activeCampaignId) || campaigns[0];

  return (
    <Screen refreshing={query.isRefetching} onRefresh={reload}>
      <Stack.Screen options={{ title: release.title || "Release Content" }} />
      <BackLink label="Back to Release" onPress={() => router.push(`/releases/${id}`)} />

      <View className="overflow-hidden rounded-3xl border border-border/60 bg-card p-5">
        <View className="flex-row gap-4">
          <ArtworkImage src={release.artwork_url} className="h-28 w-28" rounded="rounded-2xl" />
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <StatusBadge status={release.status || "draft"} />
              <View className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5">
                <Text className="text-[10px] uppercase tracking-wider text-muted-foreground">Release Content</Text>
              </View>
            </View>
            <Text className="mt-2 font-heading text-2xl" numberOfLines={1}>
              {release.title || "Untitled"}
            </Text>
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {artist?.name || "Unknown artist"}
            </Text>
          </View>
        </View>
        <View className="mt-4 flex-row flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={CalendarDays}
            className="rounded-full"
            onPress={() => router.push(`/releases/${id}/calendar`)}
          >
            Calendar
          </Button>
          <Button variant="outline" size="sm" icon={Share2} className="rounded-full" onPress={() => router.push("/social")}>
            Social
          </Button>
        </View>
      </View>

      {!campaigns.length ? (
        <EmptyState
          icon={Sparkles}
          title="No campaigns linked to this release yet."
          description="Create a campaign with this release selected to generate promotional content."
          action={
            <Button className="rounded-full" onPress={() => router.push("/create")}>
              Create Campaign
            </Button>
          }
        />
      ) : (
        <>
          {campaigns.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-1">
              {campaigns.map(({ campaign, song }) => {
                const selected = active?.campaign.id === campaign.id;
                return (
                  <Pressable
                    key={campaign.id}
                    onPress={() => setActiveCampaignId(campaign.id)}
                    className={cn(
                      "min-h-10 justify-center rounded-full px-3.5 py-2 active:opacity-80",
                      selected ? "bg-primary" : "border border-border/60 bg-muted/30"
                    )}
                  >
                    <Text className={cn("text-xs font-600", selected ? "text-primary-foreground" : "text-muted-foreground")}>
                      {song?.title || campaign.name || "Campaign"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {active ? (
            <ContentWorkspace
              campaign={active.campaign}
              song={active.song}
              artist={artist}
              release={release}
              days={active.days}
              content={active.content}
              videos={active.videos}
              onRefresh={reload}
              embedLibrary
            />
          ) : null}
        </>
      )}
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
