import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { CheckCircle2, Film, Play, Plus, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { getTemplate } from '@/services/videoTemplates';

export function readyVideoUrl(project: any): string | null {
  return project?.rendering_status === 'complete' && project?.render_output_url && /^https:\/\//i.test(project.render_output_url) ? project.render_output_url : null;
}

function PlayerBody({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} nativeControls contentFit="contain" style={{ width: '100%', aspectRatio: 9 / 16, backgroundColor: '#000', borderRadius: 16 }} />;
}

export function VideoPlayerDialog({ open, onOpenChange, url, title }: { open: boolean; onOpenChange: (o: boolean) => void; url: string | null; title?: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title || 'Video'} variant="sheet">
      {open && url ? <PlayerBody url={url} /> : null}
    </Dialog>
  );
}

/** 9:16 promo preview: artwork + overlay text, with tap-to-play for rendered MP4s. */
export function VideoPreview({ project, className }: { project: any; className?: string }) {
  const [playing, setPlaying] = useState(false);
  const url = project?.render_output_url && /^https:\/\//i.test(project.render_output_url) ? project.render_output_url : null;
  const hook = project?.text || '';
  const body = (
    <View className={cn('aspect-[9/16] w-full self-center overflow-hidden rounded-3xl border border-border bg-black', className)}>
      {project?.artwork_url ? <Image source={{ uri: project.artwork_url }} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.85 }} contentFit="cover" /> : null}
      <View className="absolute inset-0 items-center justify-center bg-black/25 px-3">
        {hook ? <Text className="text-center font-heading-bold text-base text-white" numberOfLines={4}>{hook}</Text> : null}
      </View>
      {project?.title ? (
        <View className="absolute inset-x-0 bottom-0 bg-black/45 px-3 py-2">
          <Text className="text-xs font-semibold text-white" numberOfLines={1}>{project.title}</Text>
        </View>
      ) : null}
      {url ? (
        <>
          <View className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5">
            <Text className="text-[10px] font-semibold uppercase tracking-wide text-white/90">MP4</Text>
          </View>
          <Pressable accessibilityLabel="Play video" onPress={() => setPlaying(true)} className="absolute inset-0 items-center justify-center">
            <View className="size-12 items-center justify-center rounded-full bg-black/60">
              <Icon as={Play} size={22} className="text-white" />
            </View>
          </Pressable>
        </>
      ) : null}
    </View>
  );
  return (
    <>
      {body}
      <VideoPlayerDialog open={playing} onOpenChange={setPlaying} url={url} title={project?.title} />
    </>
  );
}

export default function CampaignVideos({ campaign, videos, song }: { campaign: any; videos: any[]; song: any }) {
  const router = useRouter();
  const openEditor = (projectId?: string, remake = false) => {
    const q: string[] = [];
    if (projectId) q.push(`project=${encodeURIComponent(projectId)}`);
    if (remake) q.push('remake=1');
    router.push(`/campaigns/${campaign.id}/video?${q.join('&')}` as any);
  };

  return (
    <View className="gap-4">
      <View className="gap-3">
        <Text className="text-sm text-muted-foreground">Promo videos render on your device. Open a video to remake it with a different template or style.</Text>
        <Button onPress={() => openEditor()} className="self-start rounded-full">
          <Icon as={Plus} size={16} className="text-primary-foreground" />
          <Text className="text-sm font-medium text-primary-foreground">New Video</Text>
        </Button>
      </View>

      {videos.length ? (
        <View className="gap-4">
          {videos.map((v) => {
            const tpl = getTemplate(v.template);
            const ready = !!readyVideoUrl(v);
            return (
              <View key={v.id} className="rounded-2xl border border-border/60 bg-card/50 p-3">
                <View className="w-48 self-center">
                  <VideoPreview project={{ ...v, lyrics: song?.lyrics }} />
                </View>
                <Pressable onPress={() => openEditor(v.id)} className="mt-3 active:opacity-70">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="text-sm font-semibold">{tpl.name}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {v.duration || tpl.defaultDuration}s · 9:16
                    </Text>
                  </View>
                  <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>{v.title || song?.title}</Text>
                  <Text className="mt-0.5 text-[11px] text-muted-foreground/80" numberOfLines={1}>
                    {[v.animation_style, v.text_style].filter(Boolean).join(' · ') || 'Default style'}
                  </Text>
                </Pressable>
                <View className="mt-3 flex-row flex-wrap items-center gap-2">
                  {ready ? (
                    <View className="flex-row items-center gap-1 rounded-full bg-chart-2/15 px-2 py-0.5">
                      <Icon as={CheckCircle2} size={12} className="text-chart-2" />
                      <Text className="text-[10px] font-semibold uppercase tracking-wider text-chart-2">Ready</Text>
                    </View>
                  ) : (
                    <View className="rounded-full bg-muted/60 px-2 py-0.5">
                      <Text className="text-[10px] uppercase tracking-wider text-muted-foreground">{v.rendering_status || 'draft'}</Text>
                    </View>
                  )}
                  <Button size="sm" variant="outline" className="ml-auto rounded-full" onPress={() => openEditor(v.id)}>
                    <Icon as={Film} size={14} />
                    <Text className="text-xs font-medium">Open</Text>
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full" onPress={() => openEditor(v.id, true)}>
                    <Icon as={RefreshCw} size={14} />
                    <Text className="text-xs font-medium">Remake style</Text>
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
            <Button onPress={() => openEditor()} className="rounded-full">
              <Icon as={Plus} size={16} className="text-primary-foreground" />
              <Text className="text-sm font-medium text-primary-foreground">New Video</Text>
            </Button>
          }
        />
      )}
    </View>
  );
}
