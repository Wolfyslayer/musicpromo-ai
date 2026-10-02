import { useFocusEffect, useRouter } from 'expo-router';
import { BarChart3, Camera, Disc3, Eye, Heart, Music2, Play, RefreshCw, TrendingUp, Users } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import BarChartCard from '@/components/charts/BarChartCard';
import LineChartCard from '@/components/charts/LineChartCard';
import PieChartCard from '@/components/charts/PieChartCard';
import EmptyState from '@/components/EmptyState';
import { Screen, SectionTitle } from '@/components/Screen';
import StatCard from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { useWorkspaceRefresh } from '@/lib/AuthContext';
import { useThemeColors } from '@/lib/theme';
import { sum } from '@/services/format';
import { selectAnalyticsWorkspace } from '@/services/studioRecords';

const METRICS = ['views', 'likes', 'comments', 'shares', 'saves', 'followers_gained', 'streams', 'playlist_adds', 'clicks'];

const PLATFORM_CARDS = [
  { key: 'Instagram', label: 'Instagram', icon: Camera, color: '#e1306c' },
  { key: 'TikTok', label: 'TikTok', icon: Music2, color: '#ff2d55' },
  { key: 'YouTube', label: 'YouTube', icon: Play, color: '#ff0000' },
  { key: 'Spotify', label: 'Spotify', icon: Disc3, color: '#1db954' },
];

function normalizePlatform(name: any) {
  const n = String(name || '').toLowerCase();
  if (n.includes('instagram')) return 'Instagram';
  if (n.includes('tiktok')) return 'TikTok';
  if (n.includes('youtube') || n.includes('short')) return 'YouTube';
  if (n.includes('spotify')) return 'Spotify';
  return name || 'Other';
}

export default function Analytics() {
  const router = useRouter();
  const colors = useThemeColors();
  const [campaigns, setCampaigns] = useState<any[] | null>(null);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(
    () =>
      selectAnalyticsWorkspace()
        .then(({ campaigns: c, analytics: a }: any) => {
          setCampaigns(c);
          setAnalytics(a);
        })
        .catch((err: any) => {
          console.error('--- ANALYTICS LOAD ERROR ---', err);
          setCampaigns([]);
          setAnalytics([]);
          throw err;
        }),
    []
  );

  const reloadSilently = useCallback(() => {
    reload().catch(() => {});
  }, [reload]);

  useFocusEffect(reloadSilently);
  useWorkspaceRefresh(reloadSilently);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    METRICS.forEach((m) => (t[m] = sum(analytics, m)));
    return t;
  }, [analytics]);

  const byPlatform = useMemo(() => {
    const map: Record<string, number> = {};
    analytics.forEach((a) => {
      const key = normalizePlatform(a.platform);
      map[key] = (map[key] || 0) + (a.views || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const byContentType = useMemo(() => {
    const map: Record<string, number> = {};
    analytics.forEach((a) => {
      map[a.content_type || 'Other'] = (map[a.content_type || 'Other'] || 0) + (a.views || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const platformBreakdown = useMemo(
    () =>
      PLATFORM_CARDS.map((p) => {
        const rows = analytics.filter((a) => normalizePlatform(a.platform) === p.key);
        const views = sum(rows, 'views');
        const likes = sum(rows, 'likes');
        const comments = sum(rows, 'comments');
        const shares = sum(rows, 'shares');
        const engagement = likes + comments + shares + sum(rows, 'saves');
        const rate = views > 0 ? (engagement / views) * 100 : 0;
        return { ...p, views, likes, comments, shares, engagement, rate, entries: rows.length };
      }),
    [analytics]
  );

  const streamSeries = useMemo(() => {
    const byDate: Record<string, any> = {};
    analytics.forEach((a) => {
      const date = a.date || 'unknown';
      if (!byDate[date]) {
        byDate[date] = { date, Instagram: 0, TikTok: 0, YouTube: 0, engagement: 0 };
      }
      const plat = normalizePlatform(a.platform);
      if (plat === 'Instagram' || plat === 'TikTok' || plat === 'YouTube') {
        byDate[date][plat] += Number(a.views || a.streams || 0);
      }
      byDate[date].engagement += Number(a.likes || 0) + Number(a.comments || 0) + Number(a.shares || 0) + Number(a.saves || 0);
    });
    return Object.values(byDate).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
  }, [analytics]);

  const engagement = totals.likes + totals.comments + totals.shares + totals.saves || 0;
  const loading = campaigns === null;
  const syncedCount = analytics.filter((a) => a.source === 'synced').length;

  const onSync = async () => {
    setSyncing(true);
    try {
      await reload();
      toast({
        title: 'Analytics refreshed',
        description: 'Loaded the latest views, likes, and engagement saved to your account.',
      });
    } catch (err: any) {
      console.error('--- SOCIAL STATS SYNC ERROR ---', err);
      toast({
        variant: 'destructive',
        title: 'Sync failed',
        description: err?.message || 'Could not sync platform stats.',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Screen tabScreen onRefresh={() => reload().catch(() => {})}>
      <View className="gap-3">
        <View>
          <Text className="font-heading-bold text-2xl tracking-tight">Analytics</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            Live platform stats auto-sync daily via the background worker
            {syncedCount ? ` · ${syncedCount} synced entries` : ''}.
          </Text>
        </View>
        <Button size="sm" variant="outline" className="self-start rounded-full" onPress={onSync} disabled={syncing}>
          <Icon as={RefreshCw} size={14} className="text-foreground" />
          <Text className="text-xs font-medium">{syncing ? 'Syncing…' : 'Sync from platforms'}</Text>
        </Button>
      </View>

      {loading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : analytics.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Publish short videos from Social Hub — daily sync (or Sync now) fills views and engagement graphs."
          action={
            <View className="flex-row flex-wrap justify-center gap-2">
              <Button variant="outline" className="rounded-full" onPress={onSync}>
                Sync from platforms
              </Button>
              <Button className="rounded-full" onPress={() => router.push('/campaigns')}>
                Go to Campaigns
              </Button>
            </View>
          }
        />
      ) : (
        <>
          <View className="flex-row flex-wrap gap-3">
            <StatCard className="min-w-[44%] flex-1" label="Total Views" value={totals.views.toLocaleString()} icon={Eye} />
            <StatCard className="min-w-[44%] flex-1" label="Engagement" value={engagement.toLocaleString()} icon={Heart} accent="accent" />
            <StatCard className="min-w-[44%] flex-1" label="Streams" value={totals.streams.toLocaleString()} icon={TrendingUp} accent="chart-3" />
            <StatCard className="min-w-[44%] flex-1" label="Followers +" value={totals.followers_gained.toLocaleString()} icon={Users} accent="chart-1" />
          </View>

          <View>
            <SectionTitle>Short video platforms</SectionTitle>
            <View className="flex-row flex-wrap gap-3">
              {platformBreakdown.map((p) => (
                <View key={p.key} className="min-w-[44%] flex-1 rounded-2xl border border-border/60 bg-card/50 p-4">
                  <View className="mb-3 flex-row items-center gap-2">
                    <View className="size-8 items-center justify-center rounded-full" style={{ backgroundColor: `${p.color}22` }}>
                      <Icon as={p.icon} size={16} color={p.color} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {p.label}
                      </Text>
                      <Text className="text-xs text-muted-foreground">{p.entries} entries</Text>
                    </View>
                  </View>
                  <View className="flex-row flex-wrap gap-y-2">
                    {[
                      ['Views', p.views.toLocaleString()],
                      ['Likes', p.likes.toLocaleString()],
                      ['Engagement', p.engagement.toLocaleString()],
                      ['Eng. rate', `${p.rate.toFixed(1)}%`],
                    ].map(([label, value]) => (
                      <View key={label} className="w-1/2">
                        <Text className="text-xs text-muted-foreground">{label}</Text>
                        <Text className="text-sm font-semibold">{value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {streamSeries.length > 0 ? (
            <View className="gap-4">
              <LineChartCard
                title="Views over time (side-by-side platforms)"
                data={streamSeries}
                xKey="date"
                height={220}
                series={[
                  { key: 'Instagram', color: '#e1306c' },
                  { key: 'TikTok', color: '#ff2d55' },
                  { key: 'YouTube', color: '#ff0000' },
                ]}
              />
              <LineChartCard title="Engagement over time" data={streamSeries} xKey="date" height={220} series={[{ key: 'engagement', label: 'Engagement', color: colors.chart3 }]} />
            </View>
          ) : null}

          <View className="gap-4">
            <BarChartCard title="Views by Platform" data={byPlatform} height={200} />
            <PieChartCard title="Views by Content Type" data={byContentType} radius={85} />
          </View>

          <View>
            <SectionTitle>Campaigns</SectionTitle>
            <View className="gap-2">
              {(campaigns || []).map((c) => {
                const entries = analytics.filter((a) => a.campaign_id === c.id);
                const views = sum(entries, 'views');
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push(`/campaigns/${c.id}?tab=analytics` as any)}
                    className="flex-row items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/40 p-3 active:opacity-80">
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {c.song?.title || 'Untitled'}
                      </Text>
                      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                        {c.artist?.name} · {entries.length} entries
                      </Text>
                    </View>
                    <Text className="text-sm font-semibold">{views.toLocaleString()} views</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}
