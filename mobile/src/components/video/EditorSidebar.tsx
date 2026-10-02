import { Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { EXPORT_DURATIONS, FONT_CHOICES, PARTICLE_EFFECTS, normalizeParticleEffect } from '@/remotion/styles';

export type EditorLook = {
  fontId: string;
  fontSize: number;
  textColor: string;
  letterSpacing: number;
  animationMs: number;
  lyricX: number;
  lyricY: number;
  particleX: number;
  particleY: number;
  wind: number;
  particleSpeed: number;
};

const COLOR_SWATCHES = ['#f2ecff', '#ffffff', '#fde047', '#fb923c', '#f472b6', '#a78bfa', '#38bdf8', '#4ade80'];

function decimals(step: number) {
  return step < 1 ? (String(step).split('.')[1] || '').length : 0;
}

export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const places = decimals(step);
  const clamp = (n: number) => Math.min(max, Math.max(min, Number(n.toFixed(places + 1))));
  const current = Number(value) || 0;
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="flex-1 text-xs text-muted-foreground">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityLabel={`Decrease ${label}`}
          onPress={() => onChange(clamp(current - step))}
          className="size-9 items-center justify-center rounded-lg border border-border bg-muted active:opacity-70">
          <Icon as={Minus} size={14} />
        </Pressable>
        <Text className="min-w-16 text-center text-sm font-semibold">
          {current.toFixed(places)}
          {suffix}
        </Text>
        <Pressable
          accessibilityLabel={`Increase ${label}`}
          onPress={() => onChange(clamp(current + step))}
          className="size-9 items-center justify-center rounded-lg border border-border bg-muted active:opacity-70">
          <Icon as={Plus} size={14} />
        </Pressable>
      </View>
    </View>
  );
}

function Chip({ label, active, onPress, className }: { label: string; active: boolean; onPress: () => void; className?: string }) {
  return (
    <Pressable
      onPress={onPress}
      className={cn('min-h-10 justify-center rounded-xl border px-3 py-2', active ? 'border-primary/60 bg-primary/15' : 'border-border bg-muted', className)}>
      <Text className={cn('text-xs font-semibold', active ? 'text-primary' : 'text-foreground')}>{label}</Text>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{children}</Text>;
}

const round = (n: number) => Math.round(n * 10) / 10;

function PositionStage({ look, onLook }: { look: EditorLook; onLook: (patch: Partial<EditorLook>) => void }) {
  const colors = useThemeColors();
  const [target, setTarget] = useState<'lyric' | 'particle'>('lyric');
  const [size, setSize] = useState({ width: 0, height: 0 });

  const place = (event: GestureResponderEvent) => {
    if (!size.width || !size.height) return;
    const x = (event.nativeEvent.locationX / size.width) * 100;
    const y = (event.nativeEvent.locationY / size.height) * 100;
    if (target === 'lyric') {
      onLook({ lyricX: round(Math.min(92, Math.max(8, x))), lyricY: round(Math.min(92, Math.max(8, y))) });
      return;
    }
    onLook({ particleX: round(Math.min(100, Math.max(0, x))), particleY: round(Math.min(100, Math.max(0, y))) });
  };

  return (
    <View className="flex-row gap-3">
      <View
        onLayout={(e: LayoutChangeEvent) => setSize(e.nativeEvent.layout)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={place}
        onResponderMove={place}
        style={{ width: 132, aspectRatio: 9 / 16, backgroundColor: colors.muted, borderColor: colors.border }}
        className="overflow-hidden rounded-xl border">
        <View pointerEvents="none" style={{ left: `${look.particleX}%`, top: `${look.particleY}%`, marginLeft: -8, marginTop: -8 }} className="absolute size-4 rounded-full border border-amber-200 bg-amber-400" />
        <View
          pointerEvents="none"
          style={{ left: `${look.lyricX}%`, top: `${look.lyricY}%`, marginLeft: -12, marginTop: -10 }}
          className="absolute h-5 w-6 items-center justify-center rounded-full border border-white bg-violet-500">
          <Text className="text-[8px] font-semibold text-white">Aa</Text>
        </View>
      </View>
      <View className="flex-1 justify-center gap-2">
        <View className="gap-2">
          <Chip label={`Lyrics ${look.lyricX}, ${look.lyricY}`} active={target === 'lyric'} onPress={() => setTarget('lyric')} />
          <Chip label={`Particles ${look.particleX}, ${look.particleY}`} active={target === 'particle'} onPress={() => setTarget('particle')} />
        </View>
        <Text className="text-[11px] text-muted-foreground">Pick a target, then tap or drag on the 9:16 frame.</Text>
      </View>
    </View>
  );
}

export default function EditorSidebar({
  look,
  duration,
  particleEffect,
  onLook,
  onDuration,
  onEffect,
  durationChoices = EXPORT_DURATIONS,
  durationLocked = false,
  className = '',
}: {
  look: EditorLook;
  duration: number;
  particleEffect?: string;
  onLook: (patch: Partial<EditorLook>) => void;
  onDuration: (seconds: number) => void;
  onEffect: (effectId: string) => void;
  durationChoices?: number[];
  durationLocked?: boolean;
  className?: string;
}) {
  const [hex, setHex] = useState<string | null>(null);
  const activeEffect = normalizeParticleEffect(particleEffect);

  return (
    <View className={cn('gap-5', className)}>
      <View className="gap-2">
        <SectionLabel>Export</SectionLabel>
        {durationLocked ? (
          <View className="rounded-lg border border-border bg-muted px-3 py-2.5">
            <Text className="text-sm font-semibold">Full track · {duration}s</Text>
          </View>
        ) : (
          <View className="flex-row gap-2">
            {durationChoices.map((seconds) => (
              <Chip key={seconds} label={`${seconds}s`} active={Number(duration) === seconds} onPress={() => onDuration(seconds)} className="flex-1 items-center" />
            ))}
          </View>
        )}
      </View>

      <View className="gap-3 border-t border-border pt-4">
        <SectionLabel>Typography</SectionLabel>
        <View className="flex-row gap-2">
          {FONT_CHOICES.map((font) => (
            <Chip key={font.id} label={font.label} active={look.fontId === font.id} onPress={() => onLook({ fontId: font.id })} className="flex-1 items-center" />
          ))}
        </View>
        <View className="gap-2">
          <Text className="text-xs text-muted-foreground">Text color</Text>
          <View className="flex-row flex-wrap items-center gap-2">
            {COLOR_SWATCHES.map((color) => (
              <Pressable
                key={color}
                accessibilityLabel={`Text color ${color}`}
                onPress={() => {
                  setHex(null);
                  onLook({ textColor: color });
                }}
                style={{ backgroundColor: color }}
                className={cn('size-9 rounded-full border-2', look.textColor.toLowerCase() === color ? 'border-primary' : 'border-border')}
              />
            ))}
            <TextInput
              value={hex ?? look.textColor}
              onChangeText={(next) => {
                setHex(next);
                if (/^#[0-9a-fA-F]{6}$/.test(next)) onLook({ textColor: next });
              }}
              onBlur={() => setHex(null)}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={7}
              accessibilityLabel="Text color hex"
              className="h-9 w-24 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
            />
          </View>
        </View>
        <Stepper label="Font size" value={look.fontSize} min={36} max={96} step={2} suffix="px" onChange={(fontSize) => onLook({ fontSize })} />
        <Stepper label="Letter spacing" value={look.letterSpacing} min={-2} max={16} step={0.5} suffix="px" onChange={(letterSpacing) => onLook({ letterSpacing })} />
        <Stepper label="Animation speed" value={look.animationMs} min={80} max={900} step={20} suffix="ms" onChange={(animationMs) => onLook({ animationMs })} />
      </View>

      <View className="gap-3 border-t border-border pt-4">
        <SectionLabel>Position</SectionLabel>
        <PositionStage look={look} onLook={onLook} />
        <Stepper label="Lyrics X" value={look.lyricX} min={8} max={92} step={2} suffix="%" onChange={(lyricX) => onLook({ lyricX })} />
        <Stepper label="Lyrics Y" value={look.lyricY} min={8} max={92} step={2} suffix="%" onChange={(lyricY) => onLook({ lyricY })} />
        <Stepper label="Particle X" value={look.particleX} min={0} max={100} step={5} suffix="%" onChange={(particleX) => onLook({ particleX })} />
        <Stepper label="Particle Y" value={look.particleY} min={0} max={100} step={5} suffix="%" onChange={(particleY) => onLook({ particleY })} />
      </View>

      <View className="gap-3 border-t border-border pt-4">
        <SectionLabel>Particles</SectionLabel>
        <View className="flex-row flex-wrap gap-2">
          {PARTICLE_EFFECTS.map((effect) => (
            <Chip key={effect.id} label={effect.label} active={activeEffect === effect.id} onPress={() => onEffect(effect.id)} />
          ))}
        </View>
        <Text className="text-xs text-muted-foreground">{PARTICLE_EFFECTS.find((effect) => effect.id === activeEffect)?.description}</Text>
        <Stepper label="Wind" value={look.wind} min={-1} max={1} step={0.05} onChange={(wind) => onLook({ wind })} />
        <Stepper label="Particle speed" value={look.particleSpeed} min={0.1} max={1} step={0.05} onChange={(particleSpeed) => onLook({ particleSpeed })} />
      </View>
    </View>
  );
}
