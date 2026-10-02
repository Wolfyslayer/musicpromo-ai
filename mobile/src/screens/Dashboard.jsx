import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { ArrowRight, BarChart3, CalendarDays, Disc3, Film, PlayCircle, Plus, Sparkles, Users } from "lucide-react-native";
import { loadCampaigns } from "@/services/data";
import { selectCampaignVideos } from "@/services/studioRecords";
import { useAuth, useWorkspaceRefresh } from "@/lib/AuthContext";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { ProgressBar } from "@/components/ui/controls";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import CampaignCard from "@/components/CampaignCard";

export default function Dashboard() {
  const { isAuthenticated, requireAuth } = useAuth();
  const [data, setData] = useState(null);
  const [readyVideos, setReadyVideos] = useState([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setError("");
    try {
      const campaigns = await loadCampaigns();
      setData(campaigns);
      const active = campaigns.find((c) => ["active", "scheduled", "preparing"].includes(c.status));
      if (!active?.id) {
        setReadyVideos([]);
        return;
      }
      const videos = await selectCampaignVideos(active.id).catch(() => []);
      setReadyVideos(
        (videos || []).filter(
          (v) => v.rendering_status === "complete" && v.render_output_url && /^https:\/\//i.test(v.render_output_url)
        )
      );
    } catch (e) {
      setData([]);
      setReadyVideos([]);
      setError(isAuthenticated ? e.message || "Could not load campaigns." : "");
    }
  }, [isAuthenticated]);

  useEffect(() => {
    reload();
  }, [reload]);
  useWorkspaceRefresh(reload);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const campaigns = data || [];
  const active = campaigns.find((c) => ["active", "scheduled", "preparing"].includes(c.status));
  const recent = campaigns.slice(0, 6);
  const renderingCount = active ? (active.videosCount || 0) - readyVideos.length : 0;

  const quickActions = [
    { label: "New Campaign", icon: Plus, to: "/create" },
    { label: "Generate Content", icon: Sparkles, to: active ? `/campaigns/${active.id}?tab=content` : "/campaigns" },
    { label: "Video Studio", icon: Film, to: "/studio" },
    { label: "View Analytics", icon: BarChart3, to: "/analytics" },
    { label: "View Campaign Plan", icon: CalendarDays, to: active ? `/campaigns/${active.id}?tab=plan` : "/campaigns" },
    { label: "Artists", icon: Users, to: "/artists" },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} contentClassName="gap-8">
      {!isAuthenticated ? (
        <View className="flex-row items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3">
          <Text className="flex-1 text-xs">Preview mode. Look around, then sign in to upload, export, or connect.</Text>
          <Button size="sm" className="rounded-full" onPress={() => requireAuth()}>
            Sign in
          </Button>
        </View>
      ) : null}

      <View>
        <Text className="font-heading text-3xl tracking-tight">
          MusicPromo <Text className="font-heading text-3xl text-accent">AI</Text>
        </Text>
        <Text className="mt-2 max-w-md text-muted-foreground">
          Hands-off promo: auto videos, scheduled publishing, and live analytics.
        </Text>
        <Button icon={Plus} onPress={() => router.push("/create")} className="mt-5 self-start rounded-full px-5">
          New Campaign
        </Button>
      </View>

      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      {active ? (
        <View>
          <SectionTitle>Active Campaign</SectionTitle>
          <Pressable
            onPress={() => router.push(`/campaigns/${active.id}`)}
            className="overflow-hidden rounded-3xl border border-border/60 bg-card p-4 active:border-primary/40"
          >
            <View className="flex-row gap-4">
              <ArtworkImage src={active.song?.artwork_url} className="h-28 w-28" rounded="rounded-2xl" />
              <View className="min-w-0 flex-1">
                <StatusBadge status={active.status} />
                <Text className="mt-2 font-heading text-xl" numberOfLines={1}>
                  {active.song?.title || "Untitled"}
                </Text>
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  {active.artist?.name}
                </Text>
              </View>
              <Icon as={ArrowRight} size={20} className="self-center text-muted-foreground" />
            </View>
            <View className="mt-4">
              <View className="mb-1 flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Campaign progress</Text>
                <Text className="text-xs text-muted-foreground">{active.progressValue || 0}%</Text>
              </View>
              <ProgressBar value={active.progressValue || 0} />
            </View>
            <View className="mt-3 flex-row flex-wrap items-center gap-4">
              <View className="flex-row items-center gap-1.5">
                <Icon as={Film} size={16} className="text-primary" />
                <Text className="text-sm text-muted-foreground">
                  {readyVideos.length} ready{renderingCount > 0 ? ` · ${Math.max(0, renderingCount)} rendering` : ""}
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Icon as={CalendarDays} size={16} className="text-primary" />
                <Text className="text-sm text-muted-foreground">{active.daysCount || 0} posts</Text>
              </View>
            </View>
          </Pressable>
        </View>
      ) : !data ? (
        <View className="h-40 rounded-2xl bg-muted/40" />
      ) : null}

      {active && readyVideos.length > 0 ? (
        <View>
          <SectionTitle>Ready for schedule</SectionTitle>
          <Text className="mb-3 text-sm text-muted-foreground">
            Auto-generated 9:16 promo videos — linked to campaign days for scheduled publish.
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {readyVideos.slice(0, 8).map((v) => (
              <Pressable
                key={v.id}
                onPress={() => router.push(`/campaigns/${active.id}/video?project=${v.id}`)}
                className="w-[47%] overflow-hidden rounded-2xl border border-border/60 bg-card/50"
              >
                <View className="aspect-[9/16] bg-muted/40">
                  <ArtworkImage src={v.artwork_url} className="h-full w-full" rounded="rounded-none" />
                  <View className="absolute inset-0 items-center justify-center bg-black/25">
                    <Icon as={PlayCircle} size={32} className="text-white" />
                  </View>
                </View>
                <View className="p-2">
                  <Text className="text-xs font-600" numberOfLines={1}>
                    {v.title || "Promo video"}
                  </Text>
                  <Text className="text-[10px] text-muted-foreground">{v.duration || 15}s · ready</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View>
        <SectionTitle>Quick Actions</SectionTitle>
        <View className="flex-row flex-wrap gap-3">
          {quickActions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => router.push(a.to)}
              className="w-[47%] grow gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 active:border-primary/40"
            >
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <Icon as={a.icon} size={20} className="text-primary" />
              </View>
              <Text className="text-sm font-600">{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <SectionTitle>Recent Campaigns</SectionTitle>
        {recent.length ? (
          <View className="gap-3">
            {recent.map((c) => (
              <CampaignCard key={c.id} campaign={c} song={c.song} artist={c.artist} daysCount={c.daysCount} videosCount={c.videosCount} />
            ))}
          </View>
        ) : data ? (
          <EmptyState
            icon={Sparkles}
            title="No campaigns yet"
            description="Create your first campaign and let AI build a complete promotion plan with auto videos."
            action={
              <Button icon={Plus} className="rounded-full" onPress={() => router.push("/create")}>
                New Campaign
              </Button>
            }
          />
        ) : null}
      </View>

      <Pressable onPress={() => router.push("/releases")} className="flex-row items-center gap-2 self-center">
        <Icon as={Disc3} size={14} className="text-muted-foreground" />
        <Text className="text-xs text-muted-foreground">Manage releases</Text>
      </Pressable>
    </Screen>
  );
}

function SectionTitle({ children }) {
  return <Text className="mb-3 font-heading-medium text-sm uppercase tracking-wider text-muted-foreground">{children}</Text>;
}
