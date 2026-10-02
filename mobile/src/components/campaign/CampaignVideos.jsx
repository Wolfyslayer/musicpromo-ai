import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { CircleCheck, Film, Plus, RefreshCw } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import EmptyState from "@/components/EmptyState";
import VideoPreview from "@/components/VideoPreview";
import { getTemplate } from "@/services/videoTemplates";

export default function CampaignVideos({ campaign, videos, song }) {
  const openEditor = (projectId, remake = false) => {
    const q = new URLSearchParams();
    if (projectId) q.set("project", projectId);
    if (remake) q.set("remake", "1");
    const qs = q.toString();
    router.push(`/campaigns/${campaign.id}/video${qs ? `?${qs}` : ""}`);
  };

  return (
    <View className="gap-4">
      <View className="gap-3">
        <Text className="text-sm text-muted-foreground">
          Promo videos render on your device. Open a video to remake it with a different template or style.
        </Text>
        <Button onPress={() => openEditor()} icon={Plus} className="self-start rounded-full">
          New Video
        </Button>
      </View>

      {videos.length ? (
        <View className="gap-4">
          {videos.map((v) => {
            const tpl = getTemplate(v.template);
            const ready = v.rendering_status === "complete" && v.render_output_url && /^https:\/\//i.test(v.render_output_url);
            return (
              <View key={v.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-3">
                <Pressable onPress={() => openEditor(v.id)} className="active:opacity-80">
                  <VideoPreview project={{ ...v, lyrics: song?.lyrics }} playing={false} />
                  <View className="mt-3 flex-row items-center justify-between gap-2">
                    <Text className="text-sm font-600">{tpl.name}</Text>
                    <Text className="text-xs text-muted-foreground">{v.duration || tpl.defaultDuration}s · 9:16</Text>
                  </View>
                  <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
                    {v.title || song?.title}
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-muted-foreground/80" numberOfLines={1}>
                    {[v.animation_style, v.text_style].filter(Boolean).join(" · ") || "Default style"}
                  </Text>
                </Pressable>
                <View className="mt-3 flex-row flex-wrap items-center gap-2">
                  {ready ? (
                    <View className="flex-row items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5">
                      <Icon as={CircleCheck} size={12} className="text-emerald-500" />
                      <Text className="text-[10px] font-600 uppercase tracking-wider text-emerald-500">Ready</Text>
                    </View>
                  ) : (
                    <View className="rounded-full bg-muted/60 px-2 py-0.5">
                      <Text className="text-[10px] uppercase tracking-wider text-muted-foreground">{v.rendering_status || "draft"}</Text>
                    </View>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    icon={RefreshCw}
                    className="ml-auto h-8 rounded-full"
                    onPress={() => openEditor(v.id, true)}
                  >
                    Remake style
                  </Button>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyState
          icon={Film}
          title="No videos yet"
          description="Create a campaign with artwork + audio to auto-generate a promo, or start a new video here."
          action={
            <Button onPress={() => openEditor()} icon={Plus} className="rounded-full">
              New Video
            </Button>
          }
        />
      )}
    </View>
  );
}
