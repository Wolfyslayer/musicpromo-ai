import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, CalendarDays, ListChecks, Share2 } from 'lucide-react-native';
import ContentWorkspace from '@/components/campaign/ContentWorkspace';
import { ArtworkImage } from '@/components/ArtworkImage';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { loadCampaignContent } from '@/services/data';

export default function CampaignContentScreen() {
  const { id, day: focusDayId } = useLocalSearchParams<{ id: string; day?: string }>();
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const reload = () =>
    loadCampaignContent(String(id))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load content'));

  useEffect(() => {
    setError('');
    setData(null);
    reload();
  }, [id]);

  if (error) {
    return (
      <ScrollView className="flex-1 bg-background p-4">
        <Pressable onPress={() => router.push('/campaigns')} className="mb-4 flex-row items-center gap-1.5">
          <ArrowLeft color="#64748b" size={16} />
          <Text className="text-sm text-muted-foreground">Back to campaigns</Text>
        </Pressable>
        <Text className="text-destructive">{error}</Text>
      </ScrollView>
    );
  }

  if (!data) return <ActivityIndicator className="flex-1 py-24" />;

  const campaign = data.campaign as Record<string, unknown>;
  const song = data.song as Record<string, unknown> | undefined;
  const artist = data.artist as { name?: string };
  const release = data.release as { title?: string; artwork_url?: string } | undefined;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4">
      <Pressable onPress={() => router.push(`/campaigns/${id}`)} className="flex-row items-center gap-1.5">
        <ArrowLeft color="#64748b" size={16} />
        <Text className="text-sm text-muted-foreground">Back to Campaign</Text>
      </Pressable>

      <View className="rounded-3xl border border-border bg-card p-5">
        <View className="flex-row gap-4">
          <ArtworkImage
            src={release?.artwork_url || (song?.artwork_url as string)}
            className="h-28 w-28"
            rounded="rounded-2xl"
          />
          <View className="min-w-0 flex-1">
            <StatusBadge status={String(campaign.status || 'draft')} />
            <Text className="mt-2 text-2xl font-bold text-foreground" numberOfLines={2}>
              {String(song?.title || campaign.name || 'Campaign Content')}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {artist?.name || 'Unknown artist'}
              {release?.title ? ` · ${release.title}` : ''}
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Button variant="outline" label="Plan" onPress={() => router.push(`/campaigns/${id}?tab=plan`)} />
              {campaign.release_id ? (
                <Button
                  variant="outline"
                  label="Calendar"
                  onPress={() => router.push(`/releases/${campaign.release_id}/calendar`)}
                />
              ) : null}
              <Button variant="outline" label="Social" onPress={() => router.push('/social')} />
            </View>
          </View>
        </View>
      </View>

      <ContentWorkspace
        campaign={campaign}
        song={song}
        artist={artist}
        release={release}
        days={data.days as never[]}
        content={data.content as never[]}
        videos={data.videos as never[]}
        onRefresh={reload}
        focusDayId={focusDayId || null}
        embedLibrary
      />
    </ScrollView>
  );
}
