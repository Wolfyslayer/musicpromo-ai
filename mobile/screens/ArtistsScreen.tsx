import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { MapPin, Music2, Plus } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { ArtworkImage } from '@/components/ArtworkImage';
import { Button } from '@/components/ui/Button';
import { loadArtists } from '@/services/data';
import { initials } from '@/services/format';

export default function ArtistsScreen() {
  const router = useRouter();
  const [artists, setArtists] = useState<Array<Record<string, unknown>> | null>(null);

  const reload = () => loadArtists().then(setArtists).catch(() => setArtists([]));
  useEffect(() => {
    reload();
  }, []);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-foreground">Artists</Text>
          <Text className="text-sm text-muted-foreground">Manage multiple artist profiles from one account.</Text>
        </View>
        <Button label="New Artist" onPress={() => router.push('/artists/new')} />
      </View>

      {artists?.length ? (
        <View className="gap-3">
          {artists.map((a) => (
            <Pressable
              key={String(a.id)}
              onPress={() => router.push(`/artists/${a.id}`)}
              className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4"
            >
              {a.profile_image ? (
                <ArtworkImage src={String(a.profile_image)} className="h-16 w-16 rounded-full" />
              ) : (
                <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/15">
                  <Text className="text-lg font-bold text-primary">{initials(String(a.name || ''))}</Text>
                </View>
              )}
              <View className="min-w-0 flex-1">
                <Text className="font-semibold text-foreground" numberOfLines={1}>
                  {String(a.name || 'Artist')}
                </Text>
                <View className="mt-1 flex-row flex-wrap gap-3">
                  {a.genre ? (
                    <View className="flex-row items-center gap-1">
                      <Music2 color="#64748b" size={12} />
                      <Text className="text-xs text-muted-foreground">{String(a.genre)}</Text>
                    </View>
                  ) : null}
                  {a.location ? (
                    <View className="flex-row items-center gap-1">
                      <MapPin color="#64748b" size={12} />
                      <Text className="text-xs text-muted-foreground">{String(a.location)}</Text>
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
          action={<Button label="New Artist" onPress={() => router.push('/artists/new')} />}
        />
      ) : (
        <ActivityIndicator className="py-16" />
      )}
    </ScrollView>
  );
}
