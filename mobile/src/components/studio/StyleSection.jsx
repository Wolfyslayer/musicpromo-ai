import { useState } from "react";
import { Pressable, View } from "react-native";
import { cn } from "@/lib/utils";
import { Card, Chip, Separator, Slider } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import {
  EXPORT_DURATIONS,
  FONT_CHOICES,
  PARTICLE_EFFECTS,
  VISUAL_STYLES,
  normalizeEditorLook,
  normalizeParticleEffect,
  normalizeVisualStyle,
} from "@/services/promoStyles";
import { CAMPAIGN_PRESETS } from "./studioProject";

const VIDEO_TYPES = [
  { value: "promo", label: "Short Promo / Teaser Reel" },
  { value: "lyrics", label: "Full Lyrics Video" },
];

const COLOR_SWATCHES = ["#f2ecff", "#ffffff", "#fde047", "#f472b6", "#67e8f9", "#a3e635"];

const TYPOGRAPHY_CONTROLS = [
  { key: "fontSize", label: "Font size", min: 36, max: 96, step: 1, suffix: "px" },
  { key: "letterSpacing", label: "Letter spacing", min: -2, max: 16, step: 0.5, suffix: "px" },
  { key: "animationMs", label: "Animation speed", min: 80, max: 900, step: 10, suffix: "ms" },
];

const POSITION_CONTROLS = [
  { key: "lyricX", label: "Lyrics X", min: 8, max: 92, step: 0.5 },
  { key: "lyricY", label: "Lyrics Y", min: 8, max: 92, step: 0.5 },
  { key: "particleX", label: "Particle X", min: 0, max: 100, step: 0.5 },
  { key: "particleY", label: "Particle Y", min: 0, max: 100, step: 0.5 },
];

const PARTICLE_CONTROLS = [
  { key: "wind", label: "Wind", min: -1, max: 1, step: 0.05 },
  { key: "particleSpeed", label: "Particle speed", min: 0.1, max: 1, step: 0.05 },
];

function LookSlider({ control, look, onLook }) {
  const value = look[control.key];
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] text-muted-foreground">{control.label}</Text>
        <Text className="text-[11px]">
          {value}
          {control.suffix || ""}
        </Text>
      </View>
      <Slider
        value={value}
        min={control.min}
        max={control.max}
        step={control.step}
        onValueChange={(next) => onLook({ [control.key]: Math.round(next * 100) / 100 })}
      />
    </View>
  );
}

function HexInput({ value, onCommit }) {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      value={draft}
      onChangeText={setDraft}
      onEndEditing={() => (/^#[0-9a-fA-F]{6}$/.test(draft) ? onCommit(draft) : setDraft(value))}
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={7}
      className="w-28"
    />
  );
}

function GroupLabel({ children }) {
  return <Text className="text-[10px] font-600 uppercase tracking-[0.16em] text-muted-foreground">{children}</Text>;
}

export default function StyleSection({ project, duration, onVideoType, onField, onLook, onDuration, onPreset }) {
  const look = normalizeEditorLook(project.editor_look);
  const visualStyle = normalizeVisualStyle(project.visual_style);
  const effectId = normalizeParticleEffect(project.particle_effect);
  const effect = PARTICLE_EFFECTS.find((e) => e.id === effectId);
  const lyricsVideo = project.video_type === "lyrics";
  const durationChoices = project.video_type === "promo" ? [15, 30] : EXPORT_DURATIONS;
  const presets = project.video_type === "promo" ? CAMPAIGN_PRESETS.filter((p) => p.seconds <= 30) : CAMPAIGN_PRESETS;

  return (
    <Card className="gap-4">
      <Text className="font-heading text-base">Look</Text>

      <Field label="Video type">
        <Select value={project.video_type} onValueChange={onVideoType} options={VIDEO_TYPES} title="Video type" />
      </Field>

      {lyricsVideo ? null : (
        <View className="gap-2 rounded-2xl border border-primary/30 bg-primary/10 p-3">
          <Text className="text-[10px] font-700 uppercase tracking-[0.16em] text-primary">Campaign presets</Text>
          <View className="flex-row flex-wrap gap-2">
            {presets.map((preset) => (
              <Chip key={preset.id} selected={duration === preset.seconds} onPress={() => onPreset(preset)}>
                {`${preset.label} · ${preset.seconds}s`}
              </Chip>
            ))}
          </View>
        </View>
      )}

      <View className="gap-2">
        <Label className="text-xs text-muted-foreground">Visual style</Label>
        {VISUAL_STYLES.map((style) => (
          <Pressable
            key={style.id}
            onPress={() => onField("visual_style", style.id)}
            className={cn(
              "rounded-xl border p-3 active:opacity-80",
              visualStyle === style.id ? "border-primary/50 bg-primary/10" : "border-border"
            )}
          >
            <Text className="text-sm font-600">{style.label}</Text>
            <Text className="mt-0.5 text-[11px] text-muted-foreground" numberOfLines={2}>
              {style.description}
            </Text>
          </Pressable>
        ))}
      </View>

      <Separator />
      <GroupLabel>Export</GroupLabel>
      <Field label="Duration">
        {lyricsVideo ? (
          <Text className="rounded-lg border border-border bg-muted px-3 py-2 text-sm font-600">Full track · {duration}s</Text>
        ) : (
          <View className="flex-row gap-2">
            {durationChoices.map((seconds) => (
              <Chip key={seconds} selected={duration === seconds} onPress={() => onDuration(seconds)}>
                {`${seconds}s`}
              </Chip>
            ))}
          </View>
        )}
      </Field>

      <Separator />
      <GroupLabel>Typography</GroupLabel>
      <View className="flex-row flex-wrap gap-2">
        {FONT_CHOICES.map((font) => (
          <Chip key={font.id} selected={look.fontId === font.id} onPress={() => onLook({ fontId: font.id })}>
            {font.label}
          </Chip>
        ))}
      </View>
      <Field label="Text color">
        <View className="flex-row flex-wrap items-center gap-2">
          {COLOR_SWATCHES.map((color) => (
            <Pressable
              key={color}
              accessibilityLabel={`Text color ${color}`}
              onPress={() => onLook({ textColor: color })}
              className={cn(
                "h-9 w-9 rounded-full border-2",
                look.textColor.toLowerCase() === color ? "border-primary" : "border-border"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
          <HexInput key={look.textColor} value={look.textColor} onCommit={(textColor) => onLook({ textColor })} />
        </View>
      </Field>
      {TYPOGRAPHY_CONTROLS.map((control) => (
        <LookSlider key={control.key} control={control} look={look} onLook={onLook} />
      ))}

      <Separator />
      <GroupLabel>Position</GroupLabel>
      {POSITION_CONTROLS.map((control) => (
        <LookSlider key={control.key} control={control} look={look} onLook={onLook} />
      ))}

      <Separator />
      <GroupLabel>Particles</GroupLabel>
      <Field label="Particle effect" hint={effect?.description}>
        <Select
          value={effectId}
          onValueChange={(id) => onField("particle_effect", id)}
          options={PARTICLE_EFFECTS.map((e) => ({ value: e.id, label: e.label }))}
          title="Particle effect"
        />
      </Field>
      {PARTICLE_CONTROLS.map((control) => (
        <LookSlider key={control.key} control={control} look={look} onLook={onLook} />
      ))}
    </Card>
  );
}
