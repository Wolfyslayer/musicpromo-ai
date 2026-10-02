import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Music2, Plus } from "lucide-react-native";
import { loadArtists } from "@/services/data";
import { initials } from "@/services/format";
import { useAuth, useWorkspaceRefresh } from "@/lib/AuthContext";
import { PageHeader, Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import EmptyState from "@/components/EmptyState";
import ArtworkImage from "@/components/ArtworkImage";

export default function Artists() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ["artists", user?.id], queryFn: () => loadArtists().catch(() => []) });
  const { refetch } = query;
  const reload = useCallback(() => refetch(), [refetch]);
  useWorkspaceRefresh(reload);

  const artists = query.data ?? (query.isError ? [] : null);

  return (
    <Screen refreshing={query.isRefetching} onRefresh={reload}>
      <PageHeader title="Artists" subtitle="Manage multiple artist profiles from one account." />
      <Button icon={Plus} onPress={() => router.push("/artists/new")} className="self-start rounded-full">
        New Artist
      </Button>

      {artists?.length ? (
        <View className="gap-3">
          {artists.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => router.push(`/artists/${a.id}`)}
              className="flex-row items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 active:border-primary/40"
            >
              {a.profile_image ? (
                <ArtworkImage src={a.profile_image} className="h-16 w-16" rounded="rounded-full" />
              ) : (
                <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/15">
                  <Text className="text-lg font-700 text-primary">{initials(a.name)}</Text>
                </View>
              )}
              <View className="min-w-0 flex-1">
                <Text className="font-heading text-base" numberOfLines={1}>
                  {a.name}
                </Text>
                <View className="mt-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                  {a.genre ? (
                    <View className="flex-row items-center gap-1">
                      <Icon as={Music2} size={12} className="text-muted-foreground" />
                      <Text className="text-xs text-muted-foreground">{a.genre}</Text>
                    </View>
                  ) : null}
                  {a.location ? (
                    <View className="flex-row items-center gap-1">
                      <Icon as={MapPin} size={12} className="text-muted-foreground" />
                      <Text className="text-xs text-muted-foreground">{a.location}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ) : artists ? (
        <EmptyState
          icon={Music2}
          title="No artists yet"
          description="Create an artist profile to start building campaigns."
          action={
            <Button icon={Plus} onPress={() => router.push("/artists/new")} className="rounded-full">
              New Artist
            </Button>
          }
        />
      ) : (
        <View className="h-40 rounded-2xl bg-muted/40" />
      )}
    </Screen>
  );
}
