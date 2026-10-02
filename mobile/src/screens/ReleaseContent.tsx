import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarDays, Share2, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import ArtworkImage from '@/components/ArtworkImage';
import ContentWorkspace from '@/components/campaign/ContentWorkspace';
import EmptyState from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { loadReleaseContent } from '@/services/data';

export default function ReleaseContent() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  useEffect(() => {
    setError('');
    setData(null);
    loadReleaseContent(id)
      .then((result: any) => {
        setData(result);
        setActiveCampaignId(result.campaigns?.[0]?.campaign?.id || null);
      })
      .catch((e: any) => setError(e.message || 'Failed to load release content'));
  }, [id]);

  if (error) {
    return (
      <Screen contentClassName="gap-4">
        <Pressable onPress={() => router.replace('/releases')} className="flex-row items-center gap-1.5 self-start py-1">
          <Icon as={ArrowLeft} size={16} className="text-muted-foreground" />
          <Text className="text-sm text-muted-foreground">Back to releases</Text>
        </Pressable>
        <Text className="text-destructive">{error}</Text>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <Skeleton className="h-64 rounded-2xl" />
      </Screen>
    );
  }

  const { release, artist, campaigns } = data;
  const active = campaigns.find((c: any) => c.campaign.id === activeCampaignId) || campaigns[0];

  return (
    <Screen contentClassName="gap-5">
      <Pressable onPress={() => router.replace(`/releases/${id}`)} className="flex-row items-center gap-1.5 self-start py-1">
        <Icon as={ArrowLeft} size={16} className="text-muted-foreground" />
        <Text className="text-sm text-muted-foreground">Back to Release</Text>
      </Pressable>

      <View className="flex-row gap-4 rounded-3xl border border-border bg-card p-5">
        <ArtworkImage src={release.artwork_url} alt={release.title} className="size-24" rounded="rounded-2xl" />
        <View className="flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <StatusBadge status={release.status || 'draft'} />
            <View className="rounded-full border border-border bg-muted/40 px-2 py-0.5">
              <Text className="text-[10px] uppercase tracking-wider text-muted-foreground">Release Content</Text>
            </View>
          </View>
          <Text className="mt-2 font-heading-bold text-xl" numberOfLines={2}>
            {release.title || 'Untitled'}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {artist?.name || 'Unknown artist'}
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onPress={() => router.push(`/releases/${id}/calendar`)}>
              <Icon as={CalendarDays} size={14} className="text-foreground" />
              <Text className="text-xs font-medium">Calendar</Text>
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onPress={() => router.push('/social')}>
              <Icon as={Share2} size={14} className="text-foreground" />
              <Text className="text-xs font-medium">Social</Text>
            </Button>
          </View>
        </View>
      </View>

      {!campaigns.length ? (
        <EmptyState
          icon={Sparkles}
          title="No campaigns linked to this release yet."
          description="Create a campaign with this release selected to generate promotional content."
          action={
            <Button className="rounded-full" onPress={() => router.push('/create')}>
              Create Campaign
            </Button>
          }
        />
      ) : (
        <>
          {campaigns.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {campaigns.map(({ campaign, song }: any) => (
                <Pressable
                  key={campaign.id}
                  onPress={() => setActiveCampaignId(campaign.id)}
                  className={cn(
                    'min-h-10 justify-center rounded-full px-3.5 py-2',
                    active?.campaign.id === campaign.id ? 'bg-primary' : 'border border-border bg-muted/30'
                  )}>
                  <Text className={cn('text-xs font-semibold', active?.campaign.id === campaign.id ? 'text-primary-foreground' : 'text-muted-foreground')}>
                    {song?.title || campaign.name || 'Campaign'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {active ? (
            <ContentWorkspace
              campaign={active.campaign}
              song={active.song}
              artist={artist}
              release={release}
              days={active.days}
              content={active.content}
              videos={active.videos}
              onRefresh={() =>
                loadReleaseContent(id).then((result: any) => {
                  setData(result);
                  setActiveCampaignId(active.campaign.id);
                })
              }
              embedLibrary
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}
