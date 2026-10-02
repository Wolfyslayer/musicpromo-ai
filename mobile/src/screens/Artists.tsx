import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { MapPin, Music2, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import EmptyState from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useWorkspaceRefresh } from '@/lib/AuthContext';
import { loadArtists } from '@/services/data';
import { initials } from '@/services/format';

export default function Artists() {
  const router = useRouter();
  const [artists, setArtists] = useState<any[] | null>(null);

  const reload = useCallback(() => loadArtists().then(setArtists).catch(() => setArtists([])), []);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );
  useWorkspaceRefresh(reload);

  const newArtistButton = (
    <Button onPress={() => router.push('/artists/new')} className="rounded-full">
      <Icon as={Plus} size={16} className="text-primary-foreground" />
      <Text className="text-sm font-medium text-primary-foreground">New Artist</Text>
    </Button>
  );

  return (
    <Screen onRefresh={reload} contentClassName="gap-5">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="font-heading-bold text-2xl tracking-tight">Artists</Text>
          <Text className="text-sm text-muted-foreground">Manage multiple artist profiles from one account.</Text>
        </View>
        {newArtistButton}
      </View>

      {artists?.length ? (
        <View className="gap-3">
          {artists.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => router.push(`/artists/${a.id}`)}
              className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4 active:border-primary/40">
              {a.profile_image ? (
                <Image source={{ uri: a.profile_image }} style={{ width: 64, height: 64, borderRadius: 32 }} contentFit="cover" />
              ) : (
                <View className="size-16 items-center justify-center rounded-full bg-primary/15">
                  <Text className="font-heading-bold text-lg text-primary">{initials(a.name)}</Text>
                </View>
              )}
              <View className="flex-1">
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
        <EmptyState icon={Music2} title="No artists yet" description="Create an artist profile to start building campaigns." action={newArtistButton} />
      ) : (
        <Skeleton className="h-40 rounded-2xl" />
      )}
    </Screen>
  );
}
