// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles, Film, ImageIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';

import { platformColor } from "@/services/constants";
import { ArtworkImage } from '@/components/ArtworkImage';
import { EmptyState } from '@/components/EmptyState';
import VideoPreview from '@/components/VideoPreview';
import ContentLibrary from "@/components/campaign/ContentLibrary";
import CampaignDayContentCard from "@/components/campaign/CampaignDayContentCard";
import PromoTextCard from "@/components/campaign/PromoTextCard";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "captions", label: "Captions" },
  { id: "hooks", label: "Hooks" },
  { id: "hashtags", label: "Hashtags" },
  { id: "videos", label: "Videos" },
  { id: "artwork", label: "Artwork" },
  { id: "library", label: "Library" },
];

/**
 * Campaign Content Workspace — organizes CampaignDay promo fields +
 * GeneratedContent library + VideoProjects. Does not change AI generation.
 */
export default function ContentWorkspace({
  campaign,
  song,
  artist,
  release,
  days = [],
  content = [],
  videos = [],
  onRefresh,
  focusDayId,
  embedLibrary = false,
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    // Native scroll-to-day can be wired with refs later; focusDayId still highlights cards.
  }, [focusDayId, days]);

  const videoById = useMemo(
    () => Object.fromEntries((videos || []).map((v) => [v.id, v])),
    [videos]
  );

  const dayHasAsset = (day) =>
    !!(day.caption || day.hook || day.hashtags || day.cta || day.video_concept || day.video_project_id);

  const libraryByType = useMemo(() => {
    const map = { caption: [], hook: [], hashtags: [], cta: [], video_concept: [], idea: [] };
    for (const item of content || []) {
      const key = map[item.type] ? item.type : "idea";
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
          <View className="flex flex-wrap justify-center gap-2">
            {embedLibrary ? (
              <Button className="rounded-full" onPress={() => setFilter("library")}>
                Create Content
              </Button>
            ) : (
              <Button className="rounded-full" onPress={() => router.push(`/campaigns/${campaign.id}?tab=content`)}>
                Create Content
              </Button>
            )}
            <Button variant="outline" className="rounded-full" onPress={() => router.push(`/campaigns/${campaign.id}?tab=plan`)}>
              Open Campaign Plan
            </Button>
          </View>
        }
      />
    );
  }

  const filterEmptyMessage = () => {
    if (filter === "captions" && !days.some((d) => d.caption) && !(libraryByType.caption || []).length) {
      return "No captions yet.";
    }
    if (filter === "hooks" && !days.some((d) => d.hook) && !(libraryByType.hook || []).length) {
      return "No hooks yet.";
    }
    if (filter === "hashtags" && !days.some((d) => d.hashtags) && !(libraryByType.hashtags || []).length) {
      return "No hashtags yet.";
    }
    if (filter === "videos" && !hasVideos) {
      return "No videos yet.";
    }
    return null;
  };

  const emptyMsg = filterEmptyMessage();

  return (
    <View className="space-y-5">
      <View className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Content filters">
        {FILTERS.map((f) => (
          <View
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onPress={() => setFilter(f.id)}
            className={`min-h-10 shrink-0 rounded-full px-3.5 py-2 text-xs font-600 transition ${
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "border border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </View>
        ))}
      </View>

      {(filter === "artwork" || filter === "all") && artworkUrl && (
        <View className="rounded-2xl border border-border/60 bg-card/50 p-4">
          <View className="mb-3 flex items-center gap-2 text-sm font-600">
            <ImageIcon /> Artwork
          </View>
          <View className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <ArtworkImage
              src={artworkUrl}
              alt={release?.title || song?.title || "Artwork"}
              className="h-40 w-40"
              rounded="rounded-2xl"
            />
            <View className="min-w-0 text-sm text-muted-foreground">
              <View className="font-600 text-foreground">{release?.title || song?.title || "Untitled"}</View>
              <View className="mt-0.5">{artist?.name || "Unknown artist"}</View>
              {release ? <View className="mt-1 text-xs">Release artwork</View> : null}
              {!release && song?.artwork_url ? <View className="mt-1 text-xs">Song artwork</View> : null}
            </View>
          </View>
        </View>
      )}

      {filter === "artwork" && !artworkUrl && (
        <View className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          No artwork attached to this campaign yet.
        </View>
      )}

      {filter === "videos" && hasVideos && (
        <View className="space-y-3">
          <View className="flex items-center gap-2 text-sm font-600">
            <Film /> Videos ({videos.length})
          </View>
          <View className="grid gap-4 sm:grid-cols-2">
            {videos.map((v) => (
              <View key={v.id} className="rounded-2xl border border-border/60 bg-card/50 p-3">
                <View className="mx-auto max-w-[200px]">
                  <VideoPreview project={{ ...v, lyrics: song?.lyrics }} />
                </View>
                <View className="mt-2 truncate text-sm font-600">{v.title || song?.title || "Video"}</View>
                <Button
                 
                  className="mt-2 min-h-10 w-full rounded-full"
                  onPress={() => router.push(`/campaigns/${campaign.id}/video?project=${v.id}`)}
                >
                  <Film /> Open Video
                </Button>
              </View>
            ))}
          </View>
        </View>
      )}

      {filter !== "library" && filter !== "artwork" && filter !== "videos" && (
        <View className="space-y-3">
          <View className="flex flex-wrap items-center justify-between gap-2">
            <View className="text-sm font-600 uppercase tracking-wider text-muted-foreground">
              Campaign Days
            </View>
            {!embedLibrary && (
              <Button
               
                variant="outline"
                className="rounded-full"
                onPress={() => router.push(`/campaigns/${campaign.id}?tab=content`)}
              >
                <Sparkles /> Generate more
              </Button>
            )}
          </View>

          {!days.length ? (
            <View className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              No campaign days planned yet.
            </View>
          ) : (
            <View className="space-y-3">
              {days.map((day) => (
                <CampaignDayContentCard
                  key={day.id}
                  day={day}
                  campaignId={campaign.id}
                  video={day.video_project_id ? videoById[day.video_project_id] : null}
                  song={song}
                  filter={filter}
                  highlight={focusDayId === day.id}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Library filter: full ContentLibrary (generation). All filter: read-only summary. */}
      {filter === "library" && (
        <View className="space-y-3">
          <View className="text-sm font-600 uppercase tracking-wider text-muted-foreground">
            Content Library
          </View>
          <ContentLibrary
            campaign={campaign}
            song={{ ...song, artistName: artist?.name }}
            content={content}
            onRefresh={onRefresh}
          />
        </View>
      )}

      {filter === "all" && hasLibrary && (
        <View className="space-y-3">
          <View className="text-sm font-600 uppercase tracking-wider text-muted-foreground">
            Content Library
          </View>
          <View className="text-xs text-muted-foreground">
            Campaign-level AI content (not tied to a specific CampaignDay).
          </View>
          <View className="space-y-3">
            {["hook", "caption", "hashtags", "cta", "video_concept"].map((type) => {
              const items = libraryByType[type] || [];
              if (!items.length) return null;
              return (
                <View key={type} className="rounded-2xl border border-border/60 bg-card/50 p-4">
                  <View className="mb-2 text-sm font-600 capitalize">{type.replace("_", " ")}s</View>
                  <View className="space-y-2">
                    {items.map((item) => (
                      <View key={item.id} className="space-y-1 rounded-xl bg-muted/30 p-3">
                        {item.platform && (
                          <View
                            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-600"
                            style={{ background: `${platformColor(item.platform)}22`, color: platformColor(item.platform) }}
                          >
                            {item.platform}
                          </View>
                        )}
                        <PromoTextCard label={String(type).replace("_", " ").toUpperCase()} text={item.content} />
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
          <Button variant="outline" className="rounded-full" onPress={() => setFilter("library")}>
            Open Content Library
          </Button>
        </View>
      )}

      {emptyMsg && (
        <View className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          {emptyMsg}
        </View>
      )}
    </View>
  );
}
