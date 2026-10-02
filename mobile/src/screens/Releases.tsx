import { useFocusEffect, useRouter } from 'expo-router';
import { Calendar, Disc3, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import ArtworkImage from '@/components/ArtworkImage';
import EmptyState from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useWorkspaceRefresh } from '@/lib/AuthContext';
import { loadReleases } from '@/services/data';
import { fmtDate } from '@/services/format';

export default function Releases() {
  const router = useRouter();
  const [releases, setReleases] = useState<any[] | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(
    () =>
      loadReleases()
        .then((r) => {
          setError('');
          setReleases(r);
        })
        .catch((e) => {
          setError(e.message || 'Failed to load releases');
          setReleases([]);
        }),
    []
  );
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );
  useWorkspaceRefresh(reload);

  const newReleaseButton = (
    <Button onPress={() => router.push('/releases/new')} className="rounded-full">
      <Icon as={Plus} size={16} className="text-primary-foreground" />
      <Text className="text-sm font-medium text-primary-foreground">New Release</Text>
    </Button>
  );

  return (
    <Screen onRefresh={reload} contentClassName="gap-5">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="font-heading-bold text-2xl tracking-tight">Releases</Text>
          <Text className="text-sm text-muted-foreground">Group songs and campaigns under a release.</Text>
        </View>
        {newReleaseButton}
      </View>

      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      {releases?.length ? (
        <View className="gap-3">
          {releases.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/releases/${r.id}`)}
              className="flex-row gap-3 rounded-2xl border border-border bg-card p-3 active:border-primary/40">
              <ArtworkImage src={r.artwork_url} alt={r.title} className="size-20" rounded="rounded-xl" />
              <View className="flex-1">
                <Text className="font-heading text-base" numberOfLines={1}>
                  {r.title || 'Untitled'}
                </Text>
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  {r.artist?.name || 'Unknown artist'}
                </Text>
                <View className="mt-2">
                  <StatusBadge status={r.status || 'draft'} />
                </View>
                <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                  <View className="flex-row items-center gap-1">
                    <Icon as={Calendar} size={12} className="text-muted-foreground" />
                    <Text className="text-xs text-muted-foreground">{fmtDate(r.release_date)}</Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">{r.songsCount || 0} songs</Text>
                  <Text className="text-xs text-muted-foreground">{r.campaignsCount || 0} campaigns</Text>
                  <Pressable hitSlop={8} onPress={() => router.push(`/releases/${r.id}/calendar`)}>
                    <Text className="text-xs text-primary">Calendar</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ) : releases ? (
        <EmptyState icon={Disc3} title="No releases yet" description="Create a release to organize songs and campaigns." action={newReleaseButton} />
      ) : (
        <Skeleton className="h-40 rounded-2xl" />
      )}
    </Screen>
  );
}
