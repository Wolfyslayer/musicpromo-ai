import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Disc3, Plus, Users } from "lucide-react-native";
import { loadReleases } from "@/services/data";
import { fmtDate } from "@/services/format";
import { useAuth, useWorkspaceRefresh } from "@/lib/AuthContext";
import { PageHeader, Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import EmptyState from "@/components/EmptyState";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";

export default function Releases() {
  const { user, isAuthenticated } = useAuth();
  const query = useQuery({ queryKey: ["releases", user?.id], queryFn: loadReleases });
  const { refetch } = query;
  const reload = useCallback(() => refetch(), [refetch]);
  useWorkspaceRefresh(reload);

  const releases = query.data ?? (query.isError ? [] : null);
  const error = query.isError && isAuthenticated ? query.error?.message || "Failed to load releases" : "";

  return (
    <Screen refreshing={query.isRefetching} onRefresh={reload}>
      <PageHeader title="Releases" subtitle="Group songs and campaigns under a release." />
      <View className="flex-row gap-2">
        <Button icon={Plus} onPress={() => router.push("/releases/new")} className="flex-1 rounded-full">
          New Release
        </Button>
        <Button variant="outline" icon={Users} onPress={() => router.push("/artists")} className="rounded-full">
          Artists
        </Button>
      </View>

      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      {releases?.length ? (
        <View className="gap-3">
          {releases.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/releases/${r.id}`)}
              className="flex-row gap-3 rounded-2xl border border-border/60 bg-card p-3 active:border-primary/40"
            >
              <ArtworkImage src={r.artwork_url} className="h-20 w-20" rounded="rounded-xl" />
              <View className="min-w-0 flex-1">
                <Text className="font-heading text-base" numberOfLines={1}>
                  {r.title || "Untitled"}
                </Text>
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  {r.artist?.name || "Unknown artist"}
                </Text>
                <View className="mt-2 flex-row flex-wrap items-center gap-2">
                  <StatusBadge status={r.status || "draft"} />
                </View>
                <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                  <View className="flex-row items-center gap-1">
                    <Icon as={Calendar} size={12} className="text-muted-foreground" />
                    <Text className="text-xs text-muted-foreground">{fmtDate(r.release_date)}</Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">{r.songsCount || 0} songs</Text>
                  <Text className="text-xs text-muted-foreground">{r.campaignsCount || 0} campaigns</Text>
                  <Pressable onPress={() => router.push(`/releases/${r.id}/calendar`)} hitSlop={8}>
                    <Text className="text-xs text-primary">Calendar</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ) : releases ? (
        <EmptyState
          icon={Disc3}
          title="No releases yet"
          description="Create a release to organize songs and campaigns."
          action={
            <Button icon={Plus} onPress={() => router.push("/releases/new")} className="rounded-full">
              New Release
            </Button>
          }
        />
      ) : (
        <View className="h-40 rounded-2xl bg-muted/40" />
      )}
    </Screen>
  );
}
