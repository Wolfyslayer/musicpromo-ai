import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type VideoPreset = {
  id: string;
  label: string;
  seconds: number;
  blurb: string;
  look: Record<string, number>;
};

const PRESETS: VideoPreset[] = [
  {
    id: 'teaser',
    label: 'Teaser Short',
    seconds: 15,
    blurb: 'Stories and Shorts',
    look: { fontSize: 52, letterSpacing: -0.4, lyricY: 76, animationMs: 180, particleSpeed: 0.72 },
  },
  {
    id: 'promo',
    label: 'Full Promo',
    seconds: 30,
    blurb: 'Reels tracking',
    look: { fontSize: 64, letterSpacing: 1.4, lyricY: 82, animationMs: 280, particleSpeed: 0.5 },
  },
  {
    id: 'hype',
    label: 'Extended Hype',
    seconds: 60,
    blurb: 'Full particle length',
    look: { fontSize: 72, letterSpacing: 2, lyricY: 84, animationMs: 360, particleSpeed: 0.92 },
  },
];

export default function CampaignPresets({
  activeDuration,
  onApply,
  allowedSeconds,
}: {
  activeDuration?: number;
  onApply: (preset: VideoPreset) => void;
  allowedSeconds?: number[];
}) {
  const presets = allowedSeconds?.length ? PRESETS.filter((preset) => allowedSeconds.includes(preset.seconds)) : PRESETS;
  return (
    <View className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
      <Text className="text-[10px] font-bold uppercase tracking-widest text-primary">Campaign presets</Text>
      <View className="mt-2 gap-2">
        {presets.map((preset) => {
          const active = Number(activeDuration) === preset.seconds;
          return (
            <Pressable
              key={preset.id}
              onPress={() => onApply(preset)}
              className={cn('min-h-11 rounded-xl border px-3 py-2', active ? 'border-primary bg-primary/20' : 'border-border/70 bg-background/60')}>
              <Text className="text-sm font-bold">{preset.label}</Text>
              <Text className="text-[11px] text-muted-foreground">
                {preset.seconds}s · {preset.blurb}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
