import { useState } from "react";
import { Pressable, View } from "react-native";
import { Captions, Clapperboard } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";

export default function VideoTypeModal({ open, onOpenChange, onConfirm }) {
  const [seconds, setSeconds] = useState(15);

  const choose = (videoType) => {
    onConfirm?.({
      videoType,
      seconds: videoType === "promo" ? seconds : 0,
    });
    onOpenChange?.(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Choose a video type"
      description="This sets the timeline length, the lyric sync workspace, and whether the promo hook plays."
    >
      <View className="rounded-2xl border border-border bg-card p-4">
        <Icon as={Captions} size={20} className="text-primary" />
        <Text className="mt-3 font-heading text-base">Full Lyrics Video</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Uses the whole track, opens the auto-sync timeline, and leaves the marketing intro off.
        </Text>
        <Button className="mt-4 min-h-11 w-full rounded-full" onPress={() => choose("lyrics")}>
          Start lyrics video
        </Button>
      </View>
      <View className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
        <Icon as={Clapperboard} size={20} className="text-primary" />
        <Text className="mt-3 font-heading text-base">Short Promo / Teaser Reel</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          A 15s or 30s cut with the audio trimmer, a 3-second intro hook, and an outro button.
        </Text>
        <View className="mt-3 flex-row gap-2">
          {[15, 30].map((value) => (
            <Pressable
              key={value}
              onPress={() => setSeconds(value)}
              className={cn(
                "min-h-11 flex-1 items-center justify-center rounded-xl border",
                seconds === value ? "border-primary bg-background" : "border-border bg-background/70"
              )}
            >
              <Text className={cn("text-sm font-600", seconds === value ? "text-primary" : "text-foreground")}>{value}s</Text>
            </Pressable>
          ))}
        </View>
        <Button className="mt-4 min-h-11 w-full rounded-full" onPress={() => choose("promo")}>
          {`Start ${seconds}s teaser`}
        </Button>
      </View>
    </Dialog>
  );
}
