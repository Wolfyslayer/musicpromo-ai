import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Film,
  PlayCircle,
  Plus,
  Settings,
  Sparkles,
} from 'lucide-react-native';
import { ArtworkImage } from '@/components/ArtworkImage';
import { CampaignCard } from '@/components/CampaignCard';
import { EmptyState } from '@/components/EmptyState';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/AuthContext';
import { loadCampaigns } from '@/services/data';
import { selectCampaignVideos } from '@/services/studioRecords';

type CampaignRow = {
  id: string;
  status?: string;
  song?: { title?: string; artwork_url?: string };
  artist?: { name?: string };
  progressValue?: number;
  daysCount?: number;
  videosCount?: number;
};

type VideoRow = {
  id: string;
  title?: string;
  duration?: number;
  artwork_url?: string;
  rendering_status?: string;
  render_output_url?: string;
};

function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </Text>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { isAuthenticated, requireAuth } = useAuth();
  const [data, setData] = useState<CampaignRow[] | null>(null);
  const [readyVideos, setReadyVideos] = useState<VideoRow[]>([]);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    setError('');
    loadCampaigns()
      .then(async (campaigns) => {
        setData(campaigns as CampaignRow[]);
        const active = (campaigns as CampaignRow[]).find((c) =>
          ['active', 'scheduled', 'preparing'].includes(c.status || ''),
        );
        if (!active?.id) {
          setReadyVideos([]);
          return;
        }
        try {
          const videos = await selectCampaignVideos(active.id);
          setReadyVideos(
            (videos || []).filter(
              (v: VideoRow) =>
                v.rendering_status === 'complete' &&
                v.render_output_url &&
                /^https:\/\//i.test(v.render_output_url),
            ),
          );
        } catch {
          setReadyVideos([]);
        }
      })
      .catch((e: Error) => {
        setData([]);
        setReadyVideos([]);
        setError(isAuthenticated ? e.message || 'Could not load campaigns.' : '');
      });
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const campaigns = data || [];
  const active = campaigns.find((c) => ['active', 'scheduled', 'preparing'].includes(c.status || ''));
  const recent = campaigns.slice(0, 6);
  const renderingCount = active ? (active.videosCount || 0) - readyVideos.length : 0;

  const quickActions = [
    { label: 'New Campaign', icon: Plus, href: '/create' as const },
    {
      label: 'Generate Content',
      icon: Sparkles,
      href: active ? (`/campaigns/${active.id}?tab=content` as const) : ('/campaigns' as const),
    },
    { label: 'View Analytics', icon: BarChart3, href: '/analytics' as const },
    {
      label: 'View Campaign Plan',
      icon: CalendarDays,
      href: active ? (`/campaigns/${active.id}?tab=plan` as const) : ('/campaigns' as const),
    },
  ];

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-8 p-4 pb-10">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-heading text-3xl font-bold text-foreground">
            MusicPromo <Text className="text-primary">AI</Text>
          </Text>
          <Text className="mt-2 max-w-md text-base text-muted-foreground">
            Hands-off promo: auto videos, scheduled publishing, and live analytics.
          </Text>
          <View className="mt-5">
            <Button
              label="New Campaign"
              onPress={() => {
                if (!requireAuth(() => router.push('/create'))) router.push('/login');
              }}
            />
          </View>
        </View>
        <Link href="/settings" asChild>
          <Pressable className="rounded-xl border border-border p-2">
            <Settings color="#64748b" size={22} />
          </Pressable>
        </Link>
      </View>

      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      {active ? (
        <View>
          <SectionTitle>Active Campaign</SectionTitle>
          <Pressable
            onPress={() => router.push(`/campaigns/${active.id}`)}
            className="overflow-hidden rounded-3xl border border-border bg-card"
          >
            <View className="flex-row gap-4 p-4">
              <ArtworkImage
                src={active.song?.artwork_url}
                className="h-28 w-28"
                rounded="rounded-2xl"
              />
              <View className="min-w-0 flex-1">
                <StatusBadge status={active.status} />
                <Text className="mt-2 text-xl font-bold text-foreground" numberOfLines={2}>
                  {active.song?.title || 'Untitled'}
                </Text>
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  {active.artist?.name}
                </Text>
                <View className="mt-3">
                  <View className="mb-1 flex-row justify-between">
                    <Text className="text-xs text-muted-foreground">Campaign progress</Text>
                    <Text className="text-xs text-muted-foreground">{active.progressValue || 0}%</Text>
                  </View>
                  <ProgressBar value={active.progressValue || 0} />
                </View>
                <View className="mt-3 flex-row flex-wrap gap-3">
                  <View className="flex-row items-center gap-1.5">
                    <Film color="#8b5cf6" size={16} />
                    <Text className="text-sm text-muted-foreground">
                      {readyVideos.length} ready
                      {renderingCount > 0 ? ` · ${Math.max(0, renderingCount)} rendering` : ''}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <CalendarDays color="#8b5cf6" size={16} />
                    <Text className="text-sm text-muted-foreground">{active.daysCount || 0} posts</Text>
                  </View>
                </View>
              </View>
              <ArrowRight color="#64748b" size={20} />
            </View>
          </Pressable>
        </View>
      ) : data === null ? (
        <ActivityIndicator className="py-16" />
      ) : null}

      {active && readyVideos.length > 0 ? (
        <View>
          <SectionTitle>Ready for schedule</SectionTitle>
          <Text className="mb-3 text-sm text-muted-foreground">
            Auto-generated 9:16 promo videos — linked to campaign days for scheduled publish.
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {readyVideos.slice(0, 8).map((v) => (
              <Pressable
                key={v.id}
                onPress={() => router.push(`/campaigns/${active.id}/video?project=${v.id}`)}
                className="w-[47%] overflow-hidden rounded-2xl border border-border bg-card"
              >
                <View className="aspect-[9/16] bg-muted/40">
                  {v.artwork_url ? (
                    <Image source={{ uri: v.artwork_url }} className="h-full w-full opacity-90" />
                  ) : null}
                  <View className="absolute inset-0 items-center justify-center bg-black/25">
                    <PlayCircle color="#fff" size={32} />
                  </View>
                </View>
                <View className="p-2">
                  <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                    {v.title || 'Promo video'}
                  </Text>
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
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Pressable
                key={a.label}
                onPress={() => router.push(a.href)}
                className="w-[47%] gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                  <Icon color="#8b5cf6" size={20} />
                </View>
                <Text className="text-sm font-semibold text-foreground">{a.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <SectionTitle>Recent Campaigns</SectionTitle>
        {recent.length ? (
          <View className="gap-3">
            {recent.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                song={c.song}
                artist={c.artist}
                daysCount={c.daysCount}
                videosCount={c.videosCount}
              />
            ))}
          </View>
        ) : data ? (
          <EmptyState
            icon={Sparkles}
            title="No campaigns yet"
            description="Create your first campaign and let AI build a complete promotion plan with auto videos."
            action={
              <Button
                label="New Campaign"
                onPress={() => {
                  if (!requireAuth(() => router.push('/create'))) router.push('/login');
                }}
              />
            }
          />
        ) : null}
      </View>
    </ScrollView>
  );
}
