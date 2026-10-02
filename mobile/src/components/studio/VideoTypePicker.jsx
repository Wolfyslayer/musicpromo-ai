import { useState } from "react";
import { View } from "react-native";
import { Captions, Clapperboard } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { Heading, Text } from "@/components/ui/text";

export default function VideoTypePicker({ onConfirm }) {
  const [seconds, setSeconds] = useState(15);

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Heading className="text-xl">Choose a video type</Heading>
        <Text className="text-sm text-muted-foreground">
          This sets the timeline length, the lyric sync workspace, and whether the promo hook plays.
        </Text>
      </View>
      <View className="gap-2 rounded-2xl border border-border bg-card p-4">
        <Icon as={Captions} size={20} className="text-primary" />
        <Text className="font-heading text-base">Full Lyrics Video</Text>
        <Text className="text-sm text-muted-foreground">
          Uses the whole track, opens the auto-sync timeline, and leaves the marketing intro off.
        </Text>
        <Button className="mt-2 rounded-full" onPress={() => onConfirm({ videoType: "lyrics", seconds: 0 })}>
          Start lyrics video
        </Button>
      </View>
      <View className="gap-2 rounded-2xl border border-primary/40 bg-primary/10 p-4">
        <Icon as={Clapperboard} size={20} className="text-primary" />
        <Text className="font-heading text-base">Short Promo / Teaser Reel</Text>
        <Text className="text-sm text-muted-foreground">
          A 15s or 30s cut with the audio trimmer, a 3-second intro hook, and an outro button.
        </Text>
        <View className="mt-1 flex-row gap-2">
          {[15, 30].map((value) => (
            <Chip key={value} selected={seconds === value} onPress={() => setSeconds(value)} className="flex-1 justify-center">
              {`${value}s`}
            </Chip>
          ))}
        </View>
        <Button className="mt-2 rounded-full" onPress={() => onConfirm({ videoType: "promo", seconds })}>
          {`Start ${seconds}s teaser`}
        </Button>
      </View>
    </View>
  );
}
