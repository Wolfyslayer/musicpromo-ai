import { useMemo, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { PARTICLE_EFFECTS, clampAudioOffset, cuesInAudioWindow, formatClock, normalizeParticleEffect } from '@/remotion/styles';

type Cue = { text: string; start?: number; end?: number; timeSeconds?: number };

function effectLabel(id?: string) {
  const effect = normalizeParticleEffect(id);
  return PARTICLE_EFFECTS.find((item) => item.id === effect)?.label || 'Effect';
}

function Lane({ children, onPress, onLayout }: { children: React.ReactNode; onPress?: (x: number, width: number) => void; onLayout?: (e: LayoutChangeEvent) => void }) {
  const [width, setWidth] = useState(0);
  return (
    <Pressable
      disabled={!onPress}
      onLayout={(e) => {
        setWidth(e.nativeEvent.layout.width);
        onLayout?.(e);
      }}
      onPress={(e) => onPress?.(e.nativeEvent.locationX, width)}
      className="relative my-0.5 h-9 overflow-hidden rounded-md bg-muted/60">
      <View pointerEvents="none" className="absolute inset-0">
        {children}
      </View>
    </Pressable>
  );
}

/** Audio window, lyric clips and effect lanes with a playhead. Window and cue timing are changed with nudge buttons. */
export default function MultiTrackTimeline({
  duration = 15,
  audioDuration = 0,
  cues = [],
  effect = 'none',
  currentTime = 0,
  onSeek,
  audioOffset = 0,
  onAudioOffset,
  allowTrim = true,
}: {
  duration?: number;
  audioDuration?: number;
  cues?: Cue[];
  effect?: string;
  currentTime?: number;
  onSeek?: (localSeconds: number) => void;
  audioOffset?: number;
  onAudioOffset?: (seconds: number) => void;
  allowTrim?: boolean;
}) {
  const span = Math.max(0.001, Number(duration) || 15);
  const offset = Math.max(0, Number(audioOffset) || 0);
  const trackLength = Math.max(span, audioDuration || span);
  const windowWidth = audioDuration > span ? (span / audioDuration) * 100 : 100;
  const windowLeft = audioDuration > 0 ? (offset / audioDuration) * 100 : 0;
  const localTime = Math.max(0, Math.min(span, (Number(currentTime) || 0) - offset));
  const activeEffect = normalizeParticleEffect(effect);
  const canTrim = allowTrim && audioDuration > span;

  const clips = useMemo(
    () =>
      cuesInAudioWindow(cues, offset, span).map((cue, index) => {
        const start = Number(cue.timeSeconds ?? cue.start) || 0;
        const end = Math.max(start, Number(cue.end) || start);
        return { cue, index, left: ((start - offset) / span) * 100, width: Math.max(5, ((end - start) / span) * 100) };
      }),
    [cues, offset, span]
  );

  const nudge = (delta: number) => onAudioOffset?.(clampAudioOffset(offset + delta, audioDuration, span));

  return (
    <View className="rounded-2xl border border-border/60 bg-card px-3 py-2">
      <View className="flex-row gap-2">
        <View className="w-12 justify-around py-1">
          <Text className="text-[10px] font-semibold uppercase text-muted-foreground">Audio</Text>
          <Text className="text-[10px] font-semibold uppercase text-muted-foreground">Lyrics</Text>
          <Text className="text-[10px] font-semibold uppercase text-muted-foreground">VFX</Text>
        </View>
        <View className="flex-1">
          <Lane onPress={(x, width) => onSeek?.(width ? Math.min(1, Math.max(0, x / width)) * trackLength - offset : 0)}>
            <View
              style={{ left: `${windowLeft}%`, width: `${windowWidth}%` }}
              className="absolute bottom-0 top-0 rounded-md border-2 border-primary bg-primary/25"
            />
            <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
              <Text className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {canTrim || audioDuration > 0 ? `Selected: ${formatClock(offset)} - ${formatClock(offset + span)}` : `Full track · ${formatClock(span)}`}
              </Text>
            </View>
            <View
              pointerEvents="none"
              style={{ left: `${Math.min(100, (((Number(currentTime) || 0) / trackLength) * 100))}%` }}
              className="absolute bottom-0 top-0 w-0.5 bg-foreground"
            />
          </Lane>
          <Lane onPress={(x, width) => onSeek?.(width ? Math.min(1, Math.max(0, x / width)) * span : 0)}>
            {clips.map(({ cue, index, left, width }) => (
              <View
                key={`${cue.text}-${index}`}
                style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(100 - Math.max(0, left), width)}%` }}
                className="absolute top-1 h-7 justify-center overflow-hidden rounded-md border border-primary/40 bg-primary/25 px-1.5">
                <Text numberOfLines={1} className="text-[10px] font-semibold">
                  {cue.text}
                </Text>
              </View>
            ))}
            <View pointerEvents="none" style={{ left: `${(localTime / span) * 100}%` }} className="absolute bottom-0 top-0 w-0.5 bg-foreground" />
          </Lane>
          <Lane>
            <View
              className={cn(
                'absolute inset-y-1 left-0 right-0 justify-center rounded-md border px-2',
                activeEffect === 'none' ? 'border-border/70 bg-muted/40' : 'border-fuchsia-400/40 bg-fuchsia-500/15'
              )}>
              <Text className={cn('text-[10px] font-semibold', activeEffect === 'none' && 'text-muted-foreground')}>
                {activeEffect === 'none' ? 'No effect' : effectLabel(effect)}
              </Text>
            </View>
          </Lane>
        </View>
      </View>
      {canTrim ? (
        <View className="mt-2 flex-row items-center justify-between gap-2">
          <Text className="text-xs text-muted-foreground">Audio start</Text>
          <View className="flex-row gap-1.5">
            {[-5, -1, 1, 5].map((delta) => (
              <Pressable
                key={delta}
                accessibilityLabel={`Move audio start ${delta > 0 ? 'later' : 'earlier'} by ${Math.abs(delta)} seconds`}
                onPress={() => nudge(delta)}
                className="h-9 min-w-12 items-center justify-center rounded-lg border border-border bg-muted px-2 active:opacity-70">
                <Text className="text-xs font-semibold">{delta > 0 ? `+${delta}s` : `${delta}s`}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
