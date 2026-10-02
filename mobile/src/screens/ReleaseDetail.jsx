import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Film, Link2, ListMusic, Music2, Pencil, Plus, Share2, Sparkles } from "lucide-react-native";
import { db } from "@/api/db";
import { loadRelease } from "@/services/data";
import { fmtDate } from "@/services/format";
import { useAuth, useWorkspaceRefresh } from "@/lib/AuthContext";
import { ErrorState, LoadingState, Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import CampaignCard from "@/components/CampaignCard";

export default function ReleaseDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [songToAdd, setSongToAdd] = useState("");
  const [linking, setLinking] = useState(false);

  const query = useQuery({
    queryKey: ["release", id, user?.id],
    queryFn: () => loadRelease(id),
    enabled: Boolean(id),
  });
  const { refetch } = query;
  const reload = useCallback(() => refetch(), [refetch]);
  useWorkspaceRefresh(reload);

  const addSong = async () => {
    if (!songToAdd) return;
    setLinking(true);
    try {
      await db.entities.Song.update(songToAdd, { release_id: id });
      toast({ title: "Song added to release" });
      setSongToAdd("");
      reload();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not add song", description: e.message });
    } finally {
      setLinking(false);
    }
  };

  if (query.isError) {
    return (
      <Screen onRefresh={reload} refreshing={query.isRefetching}>
        <ErrorState message={query.error?.message || "Failed to load release"} onRetry={reload} />
        <Button variant="ghost" onPress={() => router.replace("/releases")}>
          Back to releases
        </Button>
      </Screen>
    );
  }

  if (!query.data) return <LoadingState />;

  const { release, artist, songs, campaigns, contentCount, videosCount, daysCount, unassignedSongs } = query.data;

  return (
    <Screen refreshing={query.isRefetching} onRefresh={reload} contentClassName="gap-6">
      <View className="gap-4 overflow-hidden rounded-3xl border border-border/60 bg-card p-5">
        <ArtworkImage src={release.artwork_url} className="h-36 w-36" rounded="rounded-2xl" />
        <View>
          <StatusBadge status={release.status || "draft"} />
          <Text className="mt-2 font-heading text-2xl" numberOfLines={1}>
            {release.title || "Untitled"}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {artist?.name || "Unknown artist"} · {fmtDate(release.release_date)}
          </Text>
          {release.description ? (
            <Text className="mt-2 text-sm text-muted-foreground" numberOfLines={2}>
              {release.description}
            </Text>
          ) : null}
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Button variant="outline" size="sm" icon={Pencil} className="rounded-full" onPress={() => router.push(`/releases/${id}/edit`)}>
              Edit
            </Button>
            <Button size="sm" icon={CalendarDays} className="rounded-full" onPress={() => router.push(`/releases/${id}/calendar`)}>
              View Campaign Calendar
            </Button>
            <Button variant="outline" size="sm" icon={Sparkles} className="rounded-full" onPress={() => router.push(`/releases/${id}/content`)}>
              Content
            </Button>
            <Button variant="outline" size="sm" icon={Share2} className="rounded-full" onPress={() => router.push("/social")}>
              Social
            </Button>
          </View>
        </View>
      </View>

      <View>
        <SectionLabel>Overview</SectionLabel>
        <View className="flex-row flex-wrap gap-3">
          <Stat label="Songs" value={songs.length} icon={Music2} />
          <Stat label="Campaigns" value={campaigns.length} icon={ListMusic} />
          <Stat label="Campaign days" value={daysCount || 0} icon={CalendarDays} />
          <Stat label="Content" value={contentCount} icon={Sparkles} />
          <Stat label="Videos" value={videosCount} icon={Film} />
        </View>
        {campaigns.length > 0 && !(daysCount > 0) ? (
          <View className="mt-3 flex-row flex-wrap items-center gap-1">
            <Text className="text-sm text-muted-foreground">No campaign days planned yet.</Text>
            <Pressable onPress={() => router.push(`/releases/${id}/calendar`)} hitSlop={8}>
              <Text className="text-sm text-primary">Open calendar</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between gap-2">
          <SectionLabel className="mb-0">Songs</SectionLabel>
          <Button size="sm" icon={Plus} className="rounded-full" onPress={() => router.push("/create")}>
            New Campaign
          </Button>
        </View>

        {unassignedSongs?.length > 0 ? (
          <View className="gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3">
            <Select
              value={songToAdd}
              onValueChange={setSongToAdd}
              placeholder="Add existing song…"
              title="Add existing song"
              options={unassignedSongs.map((s) => ({ value: s.id, label: s.title }))}
            />
            <Button onPress={addSong} disabled={!songToAdd || linking} variant="outline" icon={Link2} className="rounded-full">
              {linking ? "Adding…" : "Add Song"}
            </Button>
          </View>
        ) : null}

        {songs.length ? (
          <View className="gap-2">
            {songs.map((s) => {
              const related = campaigns.find((c) => c.song_id === s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => (related ? router.push(`/campaigns/${related.id}`) : router.push("/create"))}
                  className="flex-row items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-3 active:border-primary/40"
                >
                  <ArtworkImage src={s.artwork_url} className="h-12 w-12" rounded="rounded-lg" />
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-600" numberOfLines={1}>
                      {s.title}
                    </Text>
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                      {related ? "Open campaign" : "No campaign yet — create one"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon={Music2}
            title="No songs on this release"
            description="Create a campaign with this release selected, or add an existing unassigned song."
          />
        )}
      </View>

      <View className="gap-3">
        <SectionLabel className="mb-0">Campaigns</SectionLabel>
        {campaigns.length ? (
          <View className="gap-3">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} song={c.song} artist={artist} daysCount={c.daysCount || 0} videosCount={0} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon={ListMusic}
            title="No campaigns yet"
            description="Create a campaign and optionally attach this release."
            action={
              <Button icon={Plus} onPress={() => router.push("/create")} className="rounded-full">
                New Campaign
              </Button>
            }
          />
        )}
      </View>
    </Screen>
  );
}

function SectionLabel({ children, className = "mb-3" }) {
  return <Text className={`${className} font-heading-medium text-sm uppercase tracking-wider text-muted-foreground`}>{children}</Text>;
}

function Stat({ label, value, icon }) {
  return (
    <View className="w-[47%] grow rounded-2xl border border-border/60 bg-card/50 p-4">
      <View className="flex-row items-center gap-2">
        <Icon as={icon} size={16} className="text-primary" />
        <Text className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Text>
      </View>
      <Text className="mt-2 font-heading text-2xl">{value}</Text>
    </View>
  );
}
