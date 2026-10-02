import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import {
  BarChart3,
  Disc3,
  Eye,
  Heart,
  Music2,
  Share2,
  TrendingUp,
  Users,
  Video,
} from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import StatCard from '@/components/StatCard';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/toast';
import { sum } from '@/services/format';
import { selectAnalyticsWorkspace } from '@/services/studioRecords';

const CHART_COLORS = ['#a78bfa', '#ec4899', '#22d3ee', '#fbbf24', '#f87171', '#34d399'];
const METRICS = [
  'views',
  'likes',
  'comments',
  'shares',
  'saves',
  'followers_gained',
  'streams',
  'playlist_adds',
  'clicks',
];

const PLATFORM_CARDS = [
  { key: 'Instagram', label: 'Instagram', icon: Share2, color: '#e1306c' },
  { key: 'TikTok', label: 'TikTok', icon: Music2, color: '#ff2d55' },
  { key: 'YouTube', label: 'YouTube', icon: Video, color: '#ff0000' },
  { key: 'Spotify', label: 'Spotify', icon: Disc3, color: '#1db954' },
];

function normalizePlatform(name: string) {
  const n = String(name || '').toLowerCase();
  if (n.includes('instagram')) return 'Instagram';
  if (n.includes('tiktok')) return 'TikTok';
  if (n.includes('youtube') || n.includes('short')) return 'YouTube';
  if (n.includes('spotify')) return 'Spotify';
  return name || 'Other';
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <Text className="mb-3 text-sm font-semibold text-foreground">{title}</Text>
      {children}
    </View>
  );
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Array<Record<string, unknown>> | null>(null);
  const [analytics, setAnalytics] = useState<Array<Record<string, unknown>>>([]);
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(
    () =>
      selectAnalyticsWorkspace()
        .then(({ campaigns: c, analytics: a }) => {
          setCampaigns(c);
          setAnalytics(a);
        })
        .catch((err: Error) => {
          console.error('--- ANALYTICS LOAD ERROR ---', err);
          setCampaigns([]);
          setAnalytics([]);
          throw err;
        }),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      reload().catch(() => {});
    }, [reload]),
  );

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    METRICS.forEach((m) => {
      t[m] = sum(analytics, m);
    });
    return t;
  }, [analytics]);

  const byPlatform = useMemo(() => {
    const map: Record<string, number> = {};
    analytics.forEach((a) => {
      const key = normalizePlatform(String(a.platform || ''));
      map[key] = (map[key] || 0) + Number(a.views || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const byContentType = useMemo(() => {
    const map: Record<string, number> = {};
    analytics.forEach((a) => {
      const key = String(a.content_type || 'Other');
      map[key] = (map[key] || 0) + Number(a.views || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const platformBreakdown = useMemo(() => {
    return PLATFORM_CARDS.map((p) => {
      const rows = analytics.filter((a) => normalizePlatform(String(a.platform || '')) === p.key);
      const views = sum(rows, 'views');
      const likes = sum(rows, 'likes');
      const comments = sum(rows, 'comments');
      const shares = sum(rows, 'shares');
      const engagement = likes + comments + shares + sum(rows, 'saves');
      const rate = views > 0 ? (engagement / views) * 100 : 0;
      return { ...p, views, likes, comments, shares, engagement, rate, entries: rows.length };
    });
  }, [analytics]);

  const engagement =
    (totals.likes || 0) + (totals.comments || 0) + (totals.shares || 0) + (totals.saves || 0);
  const loading = campaigns === null;
  const syncedCount = analytics.filter((a) => a.source === 'synced').length;

  const barData = byPlatform.map((row, i) => ({
    value: row.value,
    label: row.name.slice(0, 8),
    frontColor: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const pieData = byContentType.map((row, i) => ({
    value: row.value,
    text: row.name,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const onSync = async () => {
    setSyncing(true);
    try {
      await reload();
      toast({
        title: 'Analytics refreshed',
        description: 'Loaded the latest views, likes, and engagement saved to your account.',
      });
    } catch (err) {
      toast({
        title: 'Sync failed',
        description: err instanceof Error ? err.message : 'Could not sync platform stats.',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 p-4 pb-10">
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-heading text-2xl font-bold text-foreground">Analytics</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            Live platform stats auto-sync daily via the background worker
            {syncedCount ? ` · ${syncedCount} synced entries` : ''}.
          </Text>
        </View>
        <Button
          variant="outline"
          label={syncing ? 'Syncing…' : 'Sync from platforms'}
          onPress={onSync}
          disabled={syncing}
        />
      </View>

      {loading ? (
        <ActivityIndicator className="py-16" />
      ) : analytics.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Publish short videos from Social Hub — daily sync (or Sync now) fills views and engagement graphs."
          action={
            <View className="gap-2">
              <Button variant="outline" label="Sync from platforms" onPress={onSync} />
              <Button label="Go to Campaigns" onPress={() => router.push('/campaigns')} />
            </View>
          }
        />
      ) : (
        <>
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[45%] flex-1">
              <StatCard label="Total Views" value={(totals.views || 0).toLocaleString()} icon={Eye} />
            </View>
            <View className="min-w-[45%] flex-1">
              <StatCard label="Engagement" value={engagement.toLocaleString()} icon={Heart} />
            </View>
            <View className="min-w-[45%] flex-1">
              <StatCard label="Streams" value={(totals.streams || 0).toLocaleString()} icon={TrendingUp} />
            </View>
            <View className="min-w-[45%] flex-1">
              <StatCard
                label="Followers +"
                value={(totals.followers_gained || 0).toLocaleString()}
                icon={Users}
              />
            </View>
          </View>

          <View>
            <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Short video platforms
            </Text>
            <View className="gap-3">
              {platformBreakdown.map((p) => {
                const Icon = p.icon;
                return (
                  <View key={p.key} className="rounded-2xl border border-border/60 bg-card/50 p-4">
                    <View className="mb-3 flex-row items-center gap-2">
                      <View
                        className="h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${p.color}22` }}
                      >
                        <Icon color={p.color} size={16} />
                      </View>
                      <View>
                        <Text className="text-sm font-semibold text-foreground">{p.label}</Text>
                        <Text className="text-xs text-muted-foreground">{p.entries} entries</Text>
                      </View>
                    </View>
                    <View className="flex-row flex-wrap gap-3">
                      <View className="min-w-[40%] flex-1">
                        <Text className="text-xs text-muted-foreground">Views</Text>
                        <Text className="font-semibold text-foreground">{p.views.toLocaleString()}</Text>
                      </View>
                      <View className="min-w-[40%] flex-1">
                        <Text className="text-xs text-muted-foreground">Likes</Text>
                        <Text className="font-semibold text-foreground">{p.likes.toLocaleString()}</Text>
                      </View>
                      <View className="min-w-[40%] flex-1">
                        <Text className="text-xs text-muted-foreground">Engagement</Text>
                        <Text className="font-semibold text-foreground">{p.engagement.toLocaleString()}</Text>
                      </View>
                      <View className="min-w-[40%] flex-1">
                        <Text className="text-xs text-muted-foreground">Eng. rate</Text>
                        <Text className="font-semibold text-foreground">{p.rate.toFixed(1)}%</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <ChartCard title="Views by Platform">
            {barData.length ? (
              <BarChart
                data={barData}
                barWidth={28}
                spacing={16}
                roundedTop
                hideRules
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={{ color: '#64748b', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#64748b', fontSize: 9 }}
                noOfSections={4}
                maxValue={Math.max(...barData.map((d) => d.value), 1) * 1.1}
              />
            ) : (
              <Text className="text-sm text-muted-foreground">No platform data</Text>
            )}
          </ChartCard>

          <ChartCard title="Views by Content Type">
            {pieData.length ? (
              <View className="items-center">
                <PieChart
                  data={pieData}
                  donut
                  radius={90}
                  innerRadius={45}
                  showText
                  textColor="#64748b"
                  textSize={10}
                />
              </View>
            ) : (
              <Text className="text-sm text-muted-foreground">No content type data</Text>
            )}
          </ChartCard>

          <View>
            <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Campaigns
            </Text>
            {(campaigns || []).map((c) => {
              const entries = analytics.filter((a) => a.campaign_id === c.id);
              const views = sum(entries, 'views');
              const song = c.song as { title?: string } | undefined;
              const artist = c.artist as { name?: string } | undefined;
              return (
                <Pressable
                  key={String(c.id)}
                  onPress={() => router.push(`/campaigns/${c.id}?tab=analytics`)}
                  className="mb-2 flex-row items-center justify-between rounded-xl border border-border/50 bg-card/40 p-3"
                >
                  <View className="min-w-0 flex-1 pr-2">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                      {song?.title || 'Untitled'}
                    </Text>
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                      {artist?.name} · {entries.length} entries
                    </Text>
                  </View>
                  <Text className="text-sm font-semibold text-foreground">{views.toLocaleString()} views</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}
