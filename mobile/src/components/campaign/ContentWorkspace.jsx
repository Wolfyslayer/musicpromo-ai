import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Film, ImageIcon, Sparkles } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { platformColor } from "@/services/constants";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import ArtworkImage from "@/components/ArtworkImage";
import EmptyState from "@/components/EmptyState";
import VideoPreview from "@/components/VideoPreview";
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

const SECTION_HEADING = "text-sm font-600 uppercase tracking-wider text-muted-foreground";

/**
 * Campaign Content Workspace — organizes CampaignDay promo fields +
 * GeneratedContent library + VideoProjects. Does not change AI generation.
 * The focused day (`focusDayId`) is highlighted and listed first so it is visible without scrolling.
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
  const [filter, setFilter] = useState("all");

  const videoById = useMemo(() => Object.fromEntries((videos || []).map((v) => [v.id, v])), [videos]);

  const orderedDays = useMemo(() => {
    const focused = focusDayId ? days.find((d) => d.id === focusDayId) : null;
    return focused ? [focused, ...days.filter((d) => d.id !== focusDayId)] : days;
  }, [days, focusDayId]);

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
          <View className="flex-row flex-wrap justify-center gap-2">
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
    <View className="gap-5">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 pb-1"
        accessibilityRole="tablist"
        accessibilityLabel="Content filters"
      >
        {FILTERS.map((f) => {
          const selected = filter === f.id;
          return (
            <Pressable
              key={f.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setFilter(f.id)}
              className={cn(
                "min-h-10 justify-center rounded-full px-3.5 py-2 active:opacity-80",
                selected ? "bg-primary" : "border border-border/60 bg-muted/30"
              )}
            >
              <Text className={cn("text-xs font-600", selected ? "text-primary-foreground" : "text-muted-foreground")}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {(filter === "artwork" || filter === "all") && artworkUrl ? (
        <View className="rounded-2xl border border-border/60 bg-card/50 p-4">
          <View className="mb-3 flex-row items-center gap-2">
            <Icon as={ImageIcon} size={16} className="text-primary" />
            <Text className="text-sm font-600">Artwork</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <ArtworkImage src={artworkUrl} className="h-40 w-40" rounded="rounded-2xl" />
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-600">{release?.title || song?.title || "Untitled"}</Text>
              <Text className="mt-0.5 text-sm text-muted-foreground">{artist?.name || "Unknown artist"}</Text>
              {release ? <Text className="mt-1 text-xs text-muted-foreground">Release artwork</Text> : null}
              {!release && song?.artwork_url ? <Text className="mt-1 text-xs text-muted-foreground">Song artwork</Text> : null}
            </View>
          </View>
        </View>
      ) : null}

      {filter === "artwork" && !artworkUrl ? <DashedMessage>No artwork attached to this campaign yet.</DashedMessage> : null}

      {filter === "videos" && hasVideos ? (
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <Icon as={Film} size={16} className="text-primary" />
            <Text className="text-sm font-600">Videos ({videos.length})</Text>
          </View>
          <View className="gap-4">
            {videos.map((v) => (
              <View key={v.id} className="rounded-2xl border border-border/60 bg-card/50 p-3">
                <View className="w-full max-w-[200px] self-center">
                  <VideoPreview project={{ ...v, lyrics: song?.lyrics }} />
                </View>
                <Text className="mt-2 text-sm font-600" numberOfLines={1}>
                  {v.title || song?.title || "Video"}
                </Text>
                <Button
                  size="sm"
                  icon={Film}
                  className="mt-2 min-h-10 w-full rounded-full"
                  onPress={() => router.push(`/campaigns/${campaign.id}/video?project=${v.id}`)}
                >
                  Open Video
                </Button>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {filter !== "library" && filter !== "artwork" && filter !== "videos" ? (
        <View className="gap-3">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className={SECTION_HEADING}>Campaign Days</Text>
            {!embedLibrary ? (
              <Button
                size="sm"
                variant="outline"
                icon={Sparkles}
                className="rounded-full"
                onPress={() => router.push(`/campaigns/${campaign.id}?tab=content`)}
              >
                Generate more
              </Button>
            ) : null}
          </View>

          {!days.length ? (
            <DashedMessage>No campaign days planned yet.</DashedMessage>
          ) : (
            <View className="gap-3">
              {orderedDays.map((day) => (
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
      ) : null}

      {filter === "library" ? (
        <View className="gap-3">
          <Text className={SECTION_HEADING}>Content Library</Text>
          <ContentLibrary
            campaign={campaign}
            song={{ ...song, artistName: artist?.name }}
            content={content}
            onRefresh={onRefresh}
          />
        </View>
      ) : null}

      {filter === "all" && hasLibrary ? (
        <View className="gap-3">
          <Text className={SECTION_HEADING}>Content Library</Text>
          <Text className="text-xs text-muted-foreground">Campaign-level AI content (not tied to a specific CampaignDay).</Text>
          <View className="gap-3">
            {["hook", "caption", "hashtags", "cta", "video_concept"].map((type) => {
              const items = libraryByType[type] || [];
              if (!items.length) return null;
              return (
                <View key={type} className="rounded-2xl border border-border/60 bg-card/50 p-4">
                  <Text className="mb-2 text-sm font-600 capitalize">{type.replace("_", " ")}s</Text>
                  <View className="gap-2">
                    {items.map((item) => (
                      <View key={item.id} className="gap-1 rounded-xl bg-muted/30 p-3">
                        {item.platform ? (
                          <View
                            className="self-start rounded-full px-2 py-0.5"
                            style={{ backgroundColor: `${platformColor(item.platform)}22` }}
                          >
                            <Text className="text-[10px] font-600" style={{ color: platformColor(item.platform) }}>
                              {item.platform}
                            </Text>
                          </View>
                        ) : null}
                        <PromoTextCard label={String(type).replace("_", " ").toUpperCase()} text={item.content} />
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
          <Button variant="outline" className="self-start rounded-full" onPress={() => setFilter("library")}>
            Open Content Library
          </Button>
        </View>
      ) : null}

      {emptyMsg ? <DashedMessage>{emptyMsg}</DashedMessage> : null}
    </View>
  );
}

function DashedMessage({ children }) {
  return (
    <View className="rounded-2xl border border-dashed border-border/60 p-6">
      <Text className="text-center text-sm text-muted-foreground">{children}</Text>
    </View>
  );
}
