import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Calendar, Disc3, Plus } from 'lucide-react-native';
import { ArtworkImage } from '@/components/ArtworkImage';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { loadReleases } from '@/services/data';
import { fmtDate } from '@/services/format';

export default function ReleasesScreen() {
  const router = useRouter();
  const [releases, setReleases] = useState<Array<Record<string, unknown>> | null>(null);
  const [error, setError] = useState('');

  const reload = () =>
    loadReleases()
      .then(setReleases)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load releases');
        setReleases([]);
      });

  useEffect(() => {
    reload();
  }, []);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-foreground">Releases</Text>
          <Text className="text-sm text-muted-foreground">Group songs and campaigns under a release.</Text>
        </View>
        <Button label="New Release" onPress={() => router.push('/releases/new')} />
      </View>

      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      {releases?.length ? (
        <View className="gap-3">
          {releases.map((r) => (
            <Pressable
              key={String(r.id)}
              onPress={() => router.push(`/releases/${r.id}`)}
              className="flex-row gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <ArtworkImage src={r.artwork_url as string} className="h-20 w-20" rounded="rounded-xl" />
              <View className="min-w-0 flex-1">
                <Text className="font-semibold text-foreground" numberOfLines={1}>
                  {String(r.title || 'Untitled')}
                </Text>
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  {(r.artist as { name?: string })?.name || 'Unknown artist'}
                </Text>
                <View className="mt-2">
                  <StatusBadge status={String(r.status || 'draft')} />
                </View>
                <View className="mt-2 flex-row flex-wrap items-center gap-3">
                  <View className="flex-row items-center gap-1">
                    <Calendar color="#64748b" size={12} />
                    <Text className="text-xs text-muted-foreground">{fmtDate(String(r.release_date || ''))}</Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">{Number(r.songsCount) || 0} songs</Text>
                  <Text className="text-xs text-muted-foreground">{Number(r.campaignsCount) || 0} campaigns</Text>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      router.push(`/releases/${r.id}/calendar`);
                    }}
                  >
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
          action={<Button label="New Release" onPress={() => router.push('/releases/new')} />}
        />
      ) : (
        <ActivityIndicator className="py-16" />
      )}
    </ScrollView>
  );
}
