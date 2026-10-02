import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, BarChart3, Film, LayoutGrid, ListChecks, Share2, Sparkles } from 'lucide-react-native';
import CampaignAnalytics from '@/components/campaign/CampaignAnalytics';
import CampaignPlan from '@/components/campaign/CampaignPlan';
import CampaignVideos from '@/components/campaign/CampaignVideos';
import ContentLibrary from '@/components/campaign/ContentLibrary';
import SongAnalysis from '@/components/campaign/SongAnalysis';
import { ArtworkImage } from '@/components/ArtworkImage';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { loadCampaign } from '@/services/data';
import { campaignProgress } from '@/services/format';

function fmtRange(c: { start_date?: string; end_date?: string }) {
  return `${c.start_date || ''} → ${c.end_date || ''}`;
}

export default function CampaignDetailScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const tab = tabParam || 'plan';
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const reload = () => {
    loadCampaign(String(id))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  };

  useEffect(() => {
    reload();
  }, [id]);

  const setTab = (v: string) => router.setParams({ tab: v });

  if (error) {
    return (
      <ScrollView className="flex-1 bg-background p-4">
        <Text className="text-destructive">{error}</Text>
      </ScrollView>
    );
  }

  if (!data) return <ActivityIndicator className="flex-1 py-24" />;

  const campaign = data.campaign as Record<string, unknown>;
  const song = data.song as Record<string, unknown> | undefined;
  const artist = data.artist as { name?: string } | undefined;
  const days = (data.days as unknown[]) || [];
  const analytics = (data.analytics as unknown[]) || [];
  const videos = (data.videos as unknown[]) || [];
  const content = (data.content as unknown[]) || [];
  const progress = campaignProgress(days as never);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 p-4">
      <Pressable onPress={() => router.push('/campaigns')} className="flex-row items-center gap-1.5">
        <ArrowLeft color="#64748b" size={16} />
        <Text className="text-sm text-muted-foreground">Back to campaigns</Text>
      </Pressable>

      <View className="rounded-3xl border border-border bg-card p-5">
        <View className="flex-row gap-4">
          <ArtworkImage src={song?.artwork_url as string} className="h-28 w-28" rounded="rounded-2xl" />
          <View className="min-w-0 flex-1">
            <StatusBadge status={String(campaign.status || 'draft')} />
            <Text className="mt-2 text-2xl font-bold text-foreground" numberOfLines={2}>
              {String(song?.title || 'Untitled')}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {artist?.name} · {fmtRange(campaign as { start_date?: string; end_date?: string })}
            </Text>
            {campaign.summary ? (
              <Text className="mt-2 text-sm text-muted-foreground" numberOfLines={2}>
                {String(campaign.summary)}
              </Text>
            ) : null}
            <View className="mt-3">
              <ProgressBar value={progress} showLabel />
            </View>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Button label="Content Workspace" onPress={() => router.push(`/campaigns/${id}/content`)} />
              <Button variant="outline" label="Social" onPress={() => router.push('/social')} />
            </View>
          </View>
        </View>
      </View>

      {song ? <SongAnalysis song={{ ...song, artistName: artist?.name }} onRefresh={reload} /> : null}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'plan', label: 'Plan' },
          { id: 'content', label: 'Content' },
          { id: 'videos', label: 'Videos' },
          { id: 'analytics', label: 'Analytics' },
        ]}
      />

      <View className="mt-2">
        {tab === 'plan' && (
          <CampaignPlan campaign={campaign} days={days} song={{ ...song, artistName: artist?.name }} onRefresh={reload} />
        )}
        {tab === 'content' && (
          <View className="gap-4">
            <View className="rounded-2xl border border-border bg-muted/20 p-3">
              <Text className="text-sm text-muted-foreground">
                Generate AI assets here, or open the Content Workspace to browse by campaign day.
              </Text>
              <Button
                variant="outline"
                className="mt-2"
                label="Open Workspace"
                onPress={() => router.push(`/campaigns/${id}/content`)}
              />
            </View>
            <ContentLibrary
              campaign={campaign}
              song={{ ...song, artistName: artist?.name }}
              content={content as never[]}
              onRefresh={reload}
            />
          </View>
        )}
        {tab === 'videos' && (
          <CampaignVideos campaign={campaign} videos={videos} song={song} />
        )}
        {tab === 'analytics' && (
          <CampaignAnalytics campaign={campaign} analytics={analytics} days={days} onRefresh={reload} />
        )}
      </View>
    </ScrollView>
  );
}
