import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, CalendarDays, Share2 } from 'lucide-react-native';
import ContentWorkspace from '@/components/campaign/ContentWorkspace';
import { ArtworkImage } from '@/components/ArtworkImage';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { loadReleaseContent } from '@/services/data';

export default function ReleaseContentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  useEffect(() => {
    setError('');
    setData(null);
    loadReleaseContent(String(id))
      .then((result) => {
        setData(result as Record<string, unknown>);
        const campaigns = (result as { campaigns?: Array<{ campaign: { id: string } }> }).campaigns;
        setActiveCampaignId(campaigns?.[0]?.campaign?.id || null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load release content'));
  }, [id]);

  if (error) {
    return (
      <ScrollView className="flex-1 bg-background p-4">
        <Pressable onPress={() => router.push('/releases')} className="mb-4 flex-row items-center gap-1.5">
          <ArrowLeft color="#64748b" size={16} />
          <Text className="text-sm text-muted-foreground">Back to releases</Text>
        </Pressable>
        <Text className="text-destructive">{error}</Text>
      </ScrollView>
    );
  }

  if (!data) return <ActivityIndicator className="flex-1 py-24" />;

  const release = data.release as Record<string, unknown>;
  const artist = data.artist as { name?: string };
  const campaigns = (data.campaigns as Array<Record<string, unknown>>) || [];
  const active =
    campaigns.find((c) => (c.campaign as { id: string }).id === activeCampaignId) || campaigns[0];

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4">
      <Pressable onPress={() => router.push(`/releases/${id}`)} className="flex-row items-center gap-1.5">
        <ArrowLeft color="#64748b" size={16} />
        <Text className="text-sm text-muted-foreground">Back to Release</Text>
      </Pressable>

      <View className="rounded-3xl border border-border bg-card p-5">
        <View className="flex-row gap-4">
          <ArtworkImage src={release.artwork_url as string} className="h-28 w-28" rounded="rounded-2xl" />
          <View className="min-w-0 flex-1">
            <StatusBadge status={String(release.status || 'draft')} />
            <Text className="mt-2 text-2xl font-bold text-foreground" numberOfLines={2}>
              {String(release.title || 'Untitled')}
            </Text>
            <Text className="text-sm text-muted-foreground">{artist?.name || 'Unknown artist'}</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Button variant="outline" label="Calendar" onPress={() => router.push(`/releases/${id}/calendar`)} />
              <Button variant="outline" label="Social" onPress={() => router.push('/social')} />
            </View>
          </View>
        </View>
      </View>

      {!campaigns.length ? (
        <EmptyState
          icon={Share2}
          title="No campaigns linked to this release yet."
          description="Create a campaign with this release selected to generate promotional content."
          action={<Button label="Create Campaign" onPress={() => router.push('/create')} />}
        />
      ) : (
        <>
          {campaigns.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
              {campaigns.map(({ campaign, song }) => {
                const c = campaign as { id: string; name?: string };
                const s = song as { title?: string } | undefined;
                const selected = (active?.campaign as { id: string })?.id === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setActiveCampaignId(c.id)}
                    className={`mr-2 rounded-full px-4 py-2 ${selected ? 'bg-primary' : 'border border-border bg-muted/30'}`}
                  >
                    <Text className={`text-xs font-semibold ${selected ? 'text-white' : 'text-muted-foreground'}`}>
                      {s?.title || c.name || 'Campaign'}
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
              days={active.days as never[]}
              content={active.content as never[]}
              videos={active.videos as never[]}
              focusDayId={null}
              onRefresh={() =>
                loadReleaseContent(String(id)).then((result) => {
                  setData(result as Record<string, unknown>);
                  setActiveCampaignId((active.campaign as { id: string }).id);
                })
              }
              embedLibrary
            />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
