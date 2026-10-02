import { useRouter } from 'expo-router';
import { Film, ImageIcon, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import ArtworkImage from '@/components/ArtworkImage';
import CampaignDayContentCard from '@/components/campaign/CampaignDayContentCard';
import { VideoPreview } from '@/components/campaign/CampaignVideos';
import ContentLibrary from '@/components/campaign/ContentLibrary';
import PromoTextCard from '@/components/campaign/PromoTextCard';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { platformColor } from '@/services/constants';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'captions', label: 'Captions' },
  { id: 'hooks', label: 'Hooks' },
  { id: 'hashtags', label: 'Hashtags' },
  { id: 'videos', label: 'Videos' },
  { id: 'artwork', label: 'Artwork' },
  { id: 'library', label: 'Library' },
];

type Props = {
  campaign: any;
  song?: any;
  artist?: any;
  release?: any;
  days?: any[];
  content?: any[];
  videos?: any[];
  onRefresh: () => void;
  focusDayId?: string | null;
  embedLibrary?: boolean;
  /** Mobile-only, optional: reports the focused day's Y offset (relative to this component) so the host screen can scroll to it. */
  onFocusDayLayout?: (y: number) => void;
};

const EmptyNote = ({ children }: { children: string }) => (
  <View className="rounded-2xl border border-dashed border-border/60 p-6">
    <Text className="text-center text-sm text-muted-foreground">{children}</Text>
  </View>
);

/**
 * Campaign Content Workspace — organizes CampaignDay promo fields +
 * GeneratedContent library + VideoProjects. Does not change AI generation.
 */
export default function ContentWorkspace({ campaign, song, artist, release, days = [], content = [], videos = [], onRefresh, focusDayId, embedLibrary = false, onFocusDayLayout }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState('all');
  const [sectionY, setSectionY] = useState<number | null>(null);
  const [listY, setListY] = useState<number | null>(null);
  const [focusCardY, setFocusCardY] = useState<number | null>(null);

  useEffect(() => {
    if (!focusDayId || !onFocusDayLayout || sectionY == null || listY == null || focusCardY == null) return undefined;
    const t = setTimeout(() => onFocusDayLayout(sectionY + listY + focusCardY), 120);
    return () => clearTimeout(t);
  }, [focusDayId, onFocusDayLayout, sectionY, listY, focusCardY, days]);

  const videoById = useMemo(() => Object.fromEntries((videos || []).map((v) => [v.id, v])), [videos]);

  const dayHasAsset = (day: any) => !!(day.caption || day.hook || day.hashtags || day.cta || day.video_concept || day.video_project_id);

  const libraryByType = useMemo(() => {
    const map: Record<string, any[]> = { caption: [], hook: [], hashtags: [], cta: [], video_concept: [], idea: [] };
    for (const item of content || []) {
      const key = map[item.type] ? item.type : 'idea';
      map[key].push(item);
    }
    return map;
  }, [content]);

  const artworkUrl = release?.artwork_url || song?.artwork_url || null;
  const hasDayCopy = days.some(dayHasAsset);
  const hasLibrary = (content || []).length > 0;
  const hasVideos = (videos || []).length > 0;
  const hasAnything = hasDayCopy || hasLibrary || hasVideos || !!artworkUrl;

  if (!hasAnything) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No promotional content yet"
        description="Generate content from your campaign plan to start building your promotion."
        action={
          <View className="flex-row flex-wrap justify-center gap-2">
            {embedLibrary ? (
              <Button className="rounded-full" onPress={() => setFilter('library')}>
                Create Content
              </Button>
            ) : (
              <Button className="rounded-full" onPress={() => router.push(`/campaigns/${campaign.id}?tab=content` as any)}>
                Create Content
              </Button>
            )}
            <Button variant="outline" className="rounded-full" onPress={() => router.push(`/campaigns/${campaign.id}?tab=plan` as any)}>
              Open Campaign Plan
            </Button>
          </View>
        }
      />
    );
  }

  const filterEmptyMessage = () => {
    if (filter === 'captions' && !days.some((d) => d.caption) && !(libraryByType.caption || []).length) return 'No captions yet.';
    if (filter === 'hooks' && !days.some((d) => d.hook) && !(libraryByType.hook || []).length) return 'No hooks yet.';
    if (filter === 'hashtags' && !days.some((d) => d.hashtags) && !(libraryByType.hashtags || []).length) return 'No hashtags yet.';
    if (filter === 'videos' && !hasVideos) return 'No videos yet.';
    return null;
  };

  const emptyMsg = filterEmptyMessage();

  return (
    <View className="gap-5">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={{ gap: 8, paddingHorizontal: 2, paddingBottom: 4 }}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === f.id }}
            onPress={() => setFilter(f.id)}
            className={cn('min-h-10 items-center justify-center rounded-full px-3.5', filter === f.id ? 'bg-primary' : 'border border-border/60 bg-muted/30')}>
            <Text className={cn('text-xs font-semibold', filter === f.id ? 'text-primary-foreground' : 'text-muted-foreground')}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {(filter === 'artwork' || filter === 'all') && artworkUrl ? (
        <View className="rounded-2xl border border-border/60 bg-card/50 p-4">
          <View className="mb-3 flex-row items-center gap-2">
            <Icon as={ImageIcon} size={16} className="text-primary" />
            <Text className="text-sm font-semibold">Artwork</Text>
          </View>
          <View className="items-start gap-3">
            <ArtworkImage src={artworkUrl} alt={release?.title || song?.title || 'Artwork'} className="size-40" rounded="rounded-2xl" />
            <View>
              <Text className="text-sm font-semibold">{release?.title || song?.title || 'Untitled'}</Text>
              <Text className="mt-0.5 text-sm text-muted-foreground">{artist?.name || 'Unknown artist'}</Text>
              {release ? <Text className="mt-1 text-xs text-muted-foreground">Release artwork</Text> : null}
              {!release && song?.artwork_url ? <Text className="mt-1 text-xs text-muted-foreground">Song artwork</Text> : null}
            </View>
          </View>
        </View>
      ) : null}

      {filter === 'artwork' && !artworkUrl ? <EmptyNote>No artwork attached to this campaign yet.</EmptyNote> : null}

      {filter === 'videos' && hasVideos ? (
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <Icon as={Film} size={16} className="text-primary" />
            <Text className="text-sm font-semibold">Videos ({videos.length})</Text>
          </View>
          <View className="gap-4">
            {videos.map((v) => (
              <View key={v.id} className="rounded-2xl border border-border/60 bg-card/50 p-3">
                <View className="w-44 self-center">
                  <VideoPreview project={{ ...v, lyrics: song?.lyrics }} />
                </View>
                <Text className="mt-2 text-sm font-semibold" numberOfLines={1}>
                  {v.title || song?.title || 'Video'}
                </Text>
                <Button size="sm" className="mt-2 min-h-10 w-full rounded-full" onPress={() => router.push(`/campaigns/${campaign.id}/video?project=${v.id}` as any)}>
                  <Icon as={Film} size={14} className="text-primary-foreground" />
                  <Text className="text-xs font-medium text-primary-foreground">Open Video</Text>
                </Button>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {filter !== 'library' && filter !== 'artwork' && filter !== 'videos' ? (
        <View className="gap-3" onLayout={(e) => setSectionY(e.nativeEvent.layout.y)}>
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Campaign Days</Text>
            {!embedLibrary ? (
              <Button size="sm" variant="outline" className="rounded-full" onPress={() => router.push(`/campaigns/${campaign.id}?tab=content` as any)}>
                <Icon as={Sparkles} size={14} />
                <Text className="text-xs font-medium">Generate more</Text>
              </Button>
            ) : null}
          </View>

          {!days.length ? (
            <EmptyNote>No campaign days planned yet.</EmptyNote>
          ) : (
            <View className="gap-3" onLayout={(e) => setListY(e.nativeEvent.layout.y)}>
              {days.map((day) => (
                <View key={day.id} onLayout={focusDayId === day.id ? (e) => setFocusCardY(e.nativeEvent.layout.y) : undefined}>
                  <CampaignDayContentCard day={day} campaignId={campaign.id} video={day.video_project_id ? videoById[day.video_project_id] : null} song={song} filter={filter} highlight={focusDayId === day.id} />
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {filter === 'library' ? (
        <View className="gap-3">
          <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Content Library</Text>
          <ContentLibrary campaign={campaign} song={{ ...song, artistName: artist?.name }} content={content} onRefresh={onRefresh} />
        </View>
      ) : null}

      {filter === 'all' && hasLibrary ? (
        <View className="gap-3">
          <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Content Library</Text>
          <Text className="text-xs text-muted-foreground">Campaign-level AI content (not tied to a specific CampaignDay).</Text>
          <View className="gap-3">
            {['hook', 'caption', 'hashtags', 'cta', 'video_concept'].map((type) => {
              const items = libraryByType[type] || [];
              if (!items.length) return null;
              return (
                <View key={type} className="rounded-2xl border border-border/60 bg-card/50 p-4">
                  <Text className="mb-2 text-sm font-semibold capitalize">{type.replace('_', ' ')}s</Text>
                  <View className="gap-2">
                    {items.map((item) => (
                      <View key={item.id} className="gap-1 rounded-xl bg-muted/30 p-3">
                        {item.platform ? (
                          <View className="self-start rounded-full px-2 py-0.5" style={{ backgroundColor: `${platformColor(item.platform)}22` }}>
                            <Text className="text-[10px] font-semibold" style={{ color: platformColor(item.platform) }}>
                              {item.platform}
                            </Text>
                          </View>
                        ) : null}
                        <PromoTextCard label={String(type).replace('_', ' ').toUpperCase()} text={item.content} />
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
          <Button variant="outline" className="rounded-full" onPress={() => setFilter('library')}>
            Open Content Library
          </Button>
        </View>
      ) : null}

      {emptyMsg ? <EmptyNote>{emptyMsg}</EmptyNote> : null}
    </View>
  );
}
