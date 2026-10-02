import { View } from "react-native";
import { Card, Slider } from "@/components/ui/controls";
import { Text } from "@/components/ui/text";
import { formatClock } from "@/services/promoStyles";

export default function AudioOffsetSection({ offset, duration, audioSeconds, onOffset }) {
  const max = Math.max(0, audioSeconds - duration);
  return (
    <Card>
      <Text className="font-heading text-base">Audio start</Text>
      {max > 0 ? (
        <>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted-foreground">Clip starts at</Text>
            <Text className="text-xs font-600">
              {formatClock(offset)} – {formatClock(offset + duration)}
            </Text>
          </View>
          <Slider value={offset} min={0} max={max} step={0.1} onValueChange={onOffset} />
          <Text className="text-xs text-muted-foreground">
            Pick which {duration}s of the {formatClock(audioSeconds)} track plays. Lyric cues outside this window are hidden.
          </Text>
        </>
      ) : (
        <Text className="text-xs text-muted-foreground">
          {audioSeconds > 0
            ? "The track is no longer than the clip, so it plays from the start."
            : "Add song audio (or wait for it to load) to choose where the clip starts."}
        </Text>
      )}
    </Card>
  );
}
