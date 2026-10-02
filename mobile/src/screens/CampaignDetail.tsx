import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, LayoutGrid, Share2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import ArtworkImage from '@/components/ArtworkImage';
import CampaignAnalytics from '@/components/campaign/CampaignAnalytics';
import CampaignPlan from '@/components/campaign/CampaignPlan';
import CampaignVideos from '@/components/campaign/CampaignVideos';
import ContentLibrary from '@/components/campaign/ContentLibrary';
import SongAnalysis from '@/components/campaign/SongAnalysis';
import ProgressBar from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { loadCampaign } from '@/services/data';
import { campaignProgress } from '@/services/format';

const TABS = [
  { value: 'plan', label: 'Plan' },
  { value: 'content', label: 'Content' },
  { value: 'videos', label: 'Videos' },
  { value: 'analytics', label: 'Analytics' },
];

const fmtRange = (c: any) => `${c.start_date || ''} → ${c.end_date || ''}`;

export default function CampaignDetail() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const [tab, setTab] = useState(tabParam || 'plan');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tabParam) setTab(tabParam);
  }, [tabParam]);

  const reload = useCallback(() => loadCampaign(id).then(setData).catch((e: any) => setError(e.message)), [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const changeTab = (v: string) => {
    setTab(v);
    router.setParams({ tab: v });
  };

  if (error) {
    return (
      <Screen>
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

  const { campaign, song, artist, days, analytics, videos, content } = data;
  const progress = campaignProgress(days);
  const songWithArtist = { ...song, artistName: artist?.name };

  return (
    <Screen onRefresh={reload}>
      <Pressable onPress={() => router.navigate('/campaigns')} className="flex-row items-center gap-1.5 self-start">
        <Icon as={ArrowLeft} size={16} className="text-muted-foreground" />
        <Text className="text-sm text-muted-foreground">Back to campaigns</Text>
      </Pressable>

      <View className="gap-4 rounded-3xl border border-border/60 bg-card p-5">
        <ArtworkImage src={song?.artwork_url} alt={song?.title} className="size-36 self-center" rounded="rounded-2xl" />
        <View>
          <StatusBadge status={campaign.status} />
          <Text className="mt-2 font-heading-bold text-2xl" numberOfLines={2}>
            {song?.title || 'Untitled'}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={2}>
            {artist?.name} · {fmtRange(campaign)}
          </Text>
          {campaign.summary ? (
            <Text className="mt-2 text-sm text-muted-foreground" numberOfLines={2}>
              {campaign.summary}
            </Text>
          ) : null}
          <View className="mt-3">
            <ProgressBar value={progress} showLabel />
          </View>
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Button size="sm" className="rounded-full" onPress={() => router.push(`/campaigns/${id}/content` as any)}>
              <Icon as={LayoutGrid} size={14} className="text-primary-foreground" />
              <Text className="text-xs font-medium text-primary-foreground">Content Workspace</Text>
            </Button>
            <Button size="sm" variant="outline" className="rounded-full" onPress={() => router.push('/social' as any)}>
              <Icon as={Share2} size={14} />
              <Text className="text-xs font-medium">Social</Text>
            </Button>
          </View>
        </View>
      </View>

      {song ? <SongAnalysis song={songWithArtist} onRefresh={reload} /> : null}

      <View>
        <Tabs scrollable value={tab} onValueChange={changeTab} items={TABS} />
        <View className="mt-5">
          {tab === 'plan' ? <CampaignPlan campaign={campaign} days={days} song={songWithArtist} onRefresh={reload} /> : null}
          {tab === 'content' ? (
            <View className="gap-4">
              <View className="gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3">
                <Text className="text-sm text-muted-foreground">Generate AI assets here, or open the Content Workspace to browse by campaign day.</Text>
                <Button size="sm" variant="outline" className="self-start rounded-full" onPress={() => router.push(`/campaigns/${id}/content` as any)}>
                  <Icon as={LayoutGrid} size={14} />
                  <Text className="text-xs font-medium">Open Workspace</Text>
                </Button>
              </View>
              <ContentLibrary campaign={campaign} song={songWithArtist} content={content} onRefresh={reload} />
            </View>
          ) : null}
          {tab === 'videos' ? <CampaignVideos campaign={campaign} videos={videos} song={song} /> : null}
          {tab === 'analytics' ? <CampaignAnalytics campaign={campaign} analytics={analytics} days={days} onRefresh={reload} /> : null}
        </View>
      </View>
    </Screen>
  );
}
