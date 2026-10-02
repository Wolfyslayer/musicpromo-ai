import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image as ImageIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Platform, View, type LayoutChangeEvent } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import {
  PARTICLE_EFFECTS,
  activeLyricAtTime,
  buildLyricCues,
  cuesInAudioWindow,
  normalizeEditorLook,
  normalizeParticleEffect,
  normalizeVideoType,
  normalizeVisualStyle,
  resolveStudioDuration,
} from '@/remotion/styles';

const EFFECT_TINT: Record<string, [string, string]> = {
  stardust: ['rgba(250,204,21,0.0)', 'rgba(250,204,21,0.22)'],
  smoke: ['rgba(148,163,184,0.0)', 'rgba(148,163,184,0.35)'],
  sparks: ['rgba(251,146,60,0.0)', 'rgba(239,68,68,0.38)'],
  leaks: ['rgba(56,189,248,0.25)', 'rgba(250,204,21,0.18)'],
  vhs: ['rgba(244,63,94,0.18)', 'rgba(56,189,248,0.18)'],
  neon: ['rgba(34,211,238,0.0)', 'rgba(217,70,239,0.32)'],
  vinyl: ['rgba(120,113,108,0.0)', 'rgba(120,113,108,0.3)'],
  rings: ['rgba(167,139,250,0.0)', 'rgba(167,139,250,0.3)'],
  shake: ['rgba(15,23,42,0.0)', 'rgba(15,23,42,0.3)'],
  prism: ['rgba(244,63,94,0.18)', 'rgba(34,211,238,0.22)'],
  fluid: ['rgba(34,211,238,0.0)', 'rgba(168,85,247,0.34)'],
  grain: ['rgba(239,68,68,0.0)', 'rgba(239,68,68,0.2)'],
};

type PreviewProject = {
  artwork_url?: string;
  title?: string;
  artist_name?: string;
  text?: string;
  lyrics?: string;
  lyric_cues?: any[];
  editor_look?: any;
  visual_style?: string;
  particle_effect?: string;
  duration?: number;
  video_type?: string;
  outro_cta?: string;
  audioStartTimeOffset?: number;
  audio_duration?: number;
  render_output_url?: string;
};

/** Static 9:16 poster: artwork with the title, hook and the active lyric laid out in the chosen look. */
export default function VideoPreview({
  project,
  currentTime = 0,
  className,
}: {
  project: PreviewProject;
  playing?: boolean;
  currentTime?: number;
  className?: string;
}) {
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [lyricHeight, setLyricHeight] = useState(0);
  const look = normalizeEditorLook(project?.editor_look);
  const style = normalizeVisualStyle(project?.visual_style);
  const effect = normalizeParticleEffect(project?.particle_effect);
  const videoType = normalizeVideoType(project?.video_type);
  const duration = resolveStudioDuration(videoType, project?.duration, project?.audio_duration);
  const offset = Math.max(0, Number(project?.audioStartTimeOffset) || 0);

  const windowCues = useMemo(
    () => cuesInAudioWindow(buildLyricCues(project?.lyrics, duration, project?.lyric_cues), offset, duration),
    [project?.lyrics, project?.lyric_cues, duration, offset]
  );
  const clock = Math.max(offset, Number(currentTime) || 0);
  const active = activeLyricAtTime(windowCues, clock) || (clock <= offset + 0.05 ? windowCues[0] : null);

  const scale = frame.width ? frame.width / 1080 : 0.3;
  const fontSize = Math.max(11, look.fontSize * scale);
  const boxWidth = frame.width * 0.84;
  const left = Math.min(Math.max(0, (look.lyricX / 100) * frame.width - boxWidth / 2), Math.max(0, frame.width - boxWidth));
  const top = (look.lyricY / 100) * frame.height - lyricHeight / 2;
  const upper = style === 'hiphop';
  const lyricText = active?.text || '';
  const tint = EFFECT_TINT[effect];
  const effectLabel = PARTICLE_EFFECTS.find((item) => item.id === effect)?.label;
  const monoFont = Platform.select({ ios: 'Courier', default: 'monospace' });

  const onLayout = (e: LayoutChangeEvent) => setFrame(e.nativeEvent.layout);

  return (
    <View onLayout={onLayout} style={{ aspectRatio: 9 / 16 }} className={cn('w-full overflow-hidden rounded-3xl border border-border/70 bg-black', className)}>
      {project?.artwork_url ? (
        <Image source={{ uri: project.artwork_url }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" transition={150} />
      ) : (
        <View className="absolute inset-0 items-center justify-center bg-muted/30">
          <Icon as={ImageIcon} size={32} className="text-muted-foreground/60" />
          <Text className="mt-2 text-xs text-muted-foreground">No artwork</Text>
        </View>
      )}
      <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.75)']} locations={[0, 0.45, 1]} style={{ position: 'absolute', width: '100%', height: '100%' }} />
      {tint ? <LinearGradient colors={tint} style={{ position: 'absolute', width: '100%', height: '100%' }} /> : null}

      <View pointerEvents="none" className="absolute inset-x-0 top-0 gap-1 p-4">
        {project?.title ? (
          <Text numberOfLines={1} className="font-heading-bold text-sm text-white">
            {project.title}
          </Text>
        ) : null}
        {project?.artist_name ? (
          <Text numberOfLines={1} className="text-xs text-white/80">
            {project.artist_name}
          </Text>
        ) : null}
        {project?.text && videoType !== 'lyrics' ? (
          <View className="mt-2 self-start rounded-full bg-white/15 px-3 py-1">
            <Text numberOfLines={2} className="text-xs text-white">
              {project.text}
            </Text>
          </View>
        ) : null}
      </View>

      {frame.width && lyricText ? (
        <View pointerEvents="none" style={{ position: 'absolute', left, top, width: boxWidth }} onLayout={(e) => setLyricHeight(e.nativeEvent.layout.height)}>
          <Text
            style={{
              color: look.textColor,
              fontSize,
              lineHeight: fontSize * 1.2,
              letterSpacing: look.letterSpacing * scale,
              textAlign: 'center',
              fontFamily: look.fontId === 'grunge' || style === 'rock' ? monoFont : undefined,
              textTransform: upper ? 'uppercase' : 'none',
              textShadowColor: upper ? 'rgba(236,72,153,0.9)' : 'rgba(0,0,0,0.65)',
              textShadowRadius: upper ? 10 : 6,
              textShadowOffset: { width: 0, height: 1 },
            }}
            className={look.fontId === 'display' ? 'font-heading-bold' : 'font-semibold'}>
            {lyricText}
          </Text>
        </View>
      ) : null}

      <View pointerEvents="none" className="absolute inset-x-0 bottom-0 flex-row items-end justify-between gap-2 p-4">
        {effectLabel && effect !== 'none' ? (
          <View className="rounded-full bg-black/55 px-2 py-0.5">
            <Text className="text-[10px] font-semibold uppercase text-white/90">{effectLabel}</Text>
          </View>
        ) : (
          <View />
        )}
        {videoType === 'promo' && project?.outro_cta ? (
          <View className="rounded-full bg-primary px-3 py-1.5">
            <Text numberOfLines={1} className="text-xs font-semibold text-primary-foreground">
              {project.outro_cta}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Plays a finished render with native controls. */
export function RenderedVideoPlayer({ url, className }: { url: string; className?: string }) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = true;
    instance.play();
  });
  return (
    <View style={{ aspectRatio: 9 / 16 }} className={cn('w-full overflow-hidden rounded-3xl border border-border/70 bg-black', className)}>
      <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls />
      <View pointerEvents="none" className="absolute left-3 top-3 rounded-full bg-black/55 px-2 py-0.5">
        <Text className="text-[10px] font-semibold uppercase text-white/90">MP4</Text>
      </View>
    </View>
  );
}
