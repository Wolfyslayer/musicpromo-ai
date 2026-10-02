import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowRight, BarChart3, CalendarDays, Film, Plus, PlayCircle, Sparkles } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import ArtworkImage from '@/components/ArtworkImage';
import CampaignCard from '@/components/CampaignCard';
import EmptyState from '@/components/EmptyState';
import ProgressBar from '@/components/ProgressBar';
import { Screen, SectionTitle } from '@/components/Screen';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAuth, useWorkspaceRefresh } from '@/lib/AuthContext';
import { loadCampaigns } from '@/services/data';
import { selectCampaignVideos } from '@/services/studioRecords';

const ACTIVE_STATUSES = ['active', 'scheduled', 'preparing'];

export default function Dashboard() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<any[] | null>(null);
  const [readyVideos, setReadyVideos] = useState<any[]>([]);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setError('');
    try {
      const campaigns = await loadCampaigns();
      setData(campaigns);
      const active = campaigns.find((c: any) => ACTIVE_STATUSES.includes(c.status));
      if (!active?.id) {
        setReadyVideos([]);
        return;
      }
      try {
        const videos = await selectCampaignVideos(active.id);
        setReadyVideos(
          (videos || []).filter(
            (v: any) => v.rendering_status === 'complete' && v.render_output_url && /^https:\/\//i.test(v.render_output_url)
          )
        );
      } catch {
        setReadyVideos([]);
      }
    } catch (e: any) {
      setData([]);
      setReadyVideos([]);
      setError(isAuthenticated ? e.message || 'Could not load campaigns.' : '');
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );
  useWorkspaceRefresh(reload);

  const campaigns = data || [];
  const active = campaigns.find((c: any) => ACTIVE_STATUSES.includes(c.status));
  const recent = campaigns.slice(0, 6);
  const renderingCount = active ? (active.videosCount || 0) - readyVideos.length : 0;

  const quickActions = [
    { label: 'New Campaign', icon: Plus, to: '/create' },
    { label: 'Generate Content', icon: Sparkles, to: active ? `/campaigns/${active.id}?tab=content` : '/campaigns' },
    { label: 'View Analytics', icon: BarChart3, to: '/analytics' },
    { label: 'View Campaign Plan', icon: CalendarDays, to: active ? `/campaigns/${active.id}?tab=plan` : '/campaigns' },
  ];

  return (
    <Screen tabScreen onRefresh={reload} contentClassName="gap-8">
      <View>
        <Text className="font-heading-bold text-3xl tracking-tight">
          MusicPromo <Text className="font-heading-bold text-3xl tracking-tight text-primary">AI</Text>
        </Text>
        <Text className="mt-2 max-w-md text-muted-foreground">Hands-off promo: auto videos, scheduled publishing, and live analytics.</Text>
        <Button onPress={() => router.push('/create')} size="lg" className="mt-5 h-11 self-start rounded-full px-5">
          <Icon as={Plus} size={16} className="text-primary-foreground" />
          <Text className="text-sm font-semibold text-primary-foreground">New Campaign</Text>
        </Button>
      </View>

      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      {active ? (
        <View>
          <SectionTitle>Active Campaign</SectionTitle>
          <Pressable
            onPress={() => router.push(`/campaigns/${active.id}`)}
            className="overflow-hidden rounded-3xl border border-border/60 bg-card active:border-primary/40">
            <View className="gap-4 p-4">
              <View className="flex-row items-center gap-4">
                <ArtworkImage src={active.song?.artwork_url} className="size-28 shrink-0" rounded="rounded-2xl" />
                <View className="min-w-0 flex-1">
                  <StatusBadge status={active.status} />
                  <Text numberOfLines={1} className="mt-2 font-heading-bold text-xl">{active.song?.title || 'Untitled'}</Text>
                  <Text numberOfLines={1} className="text-sm text-muted-foreground">{active.artist?.name}</Text>
                </View>
                <Icon as={ArrowRight} size={20} className="text-muted-foreground" />
              </View>
              <View>
                <View className="mb-1 flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">Campaign progress</Text>
                  <Text className="text-xs text-muted-foreground">{active.progressValue || 0}%</Text>
                </View>
                <ProgressBar value={active.progressValue || 0} />
              </View>
              <View className="flex-row flex-wrap items-center gap-4">
                <View className="flex-row items-center gap-1.5">
                  <Icon as={Film} size={16} className="text-primary" />
                  <Text className="text-sm text-muted-foreground">
                    {readyVideos.length} ready
                    {renderingCount > 0 ? ` · ${Math.max(0, renderingCount)} rendering` : ''}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Icon as={CalendarDays} size={16} className="text-primary" />
                  <Text className="text-sm text-muted-foreground">{active.daysCount || 0} posts</Text>
                </View>
              </View>
            </View>
          </Pressable>
        </View>
      ) : (
        !data && <Skeleton className="h-40 rounded-2xl" />
      )}

      {active && readyVideos.length > 0 ? (
        <View>
          <SectionTitle>Ready for schedule</SectionTitle>
          <Text className="mb-3 text-sm text-muted-foreground">Auto-generated 9:16 promo videos — linked to campaign days for scheduled publish.</Text>
          <View className="flex-row flex-wrap gap-3">
            {readyVideos.slice(0, 8).map((v: any) => (
              <Pressable
                key={v.id}
                onPress={() => router.push(`/campaigns/${active.id}/video?project=${v.id}`)}
                style={{ width: '48%' }}
                className="overflow-hidden rounded-2xl border border-border/60 bg-card/50 active:border-primary/40">
                <View className="items-center justify-center bg-muted/40" style={{ aspectRatio: 9 / 16 }}>
                  {v.artwork_url ? <Image source={{ uri: v.artwork_url }} style={{ width: '100%', height: '100%', opacity: 0.9 }} contentFit="cover" /> : null}
                  <View className="absolute inset-0 items-center justify-center bg-black/20">
                    <Icon as={PlayCircle} size={32} color="#ffffff" />
                  </View>
                </View>
                <View className="p-2">
                  <Text numberOfLines={1} className="text-xs font-semibold">{v.title || 'Promo video'}</Text>
                  <Text className="text-[10px] text-muted-foreground">{v.duration || 15}s · ready</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View>
        <SectionTitle>Quick Actions</SectionTitle>
        <View className="flex-row flex-wrap gap-3">
          {quickActions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => router.push(a.to as any)}
              style={{ width: '48%' }}
              className="items-start gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 active:border-primary/40">
              <View className="size-10 items-center justify-center rounded-xl bg-primary/15">
                <Icon as={a.icon} size={20} className="text-primary" />
              </View>
              <Text className="text-sm font-semibold">{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <SectionTitle>Recent Campaigns</SectionTitle>
        {recent.length ? (
          <View className="gap-3">
            {recent.map((c: any) => (
              <CampaignCard key={c.id} campaign={c} song={c.song} artist={c.artist} daysCount={c.daysCount} videosCount={c.videosCount} />
            ))}
          </View>
        ) : (
          data && (
            <EmptyState
              icon={Sparkles}
              title="No campaigns yet"
              description="Create your first campaign and let AI build a complete promotion plan with auto videos."
              action={
                <Button onPress={() => router.push('/create')} className="rounded-full">
                  <Icon as={Plus} size={16} className="text-primary-foreground" />
                  <Text className="text-sm font-medium text-primary-foreground">New Campaign</Text>
                </Button>
              }
            />
          )
        )}
      </View>
    </Screen>
  );
}
