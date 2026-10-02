import { Captions, Clapperboard } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type VideoTypeChoice = { videoType: 'lyrics' | 'promo'; seconds: number };

export default function VideoTypeModal({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: (choice: VideoTypeChoice) => void;
}) {
  const [seconds, setSeconds] = useState(15);

  const choose = (videoType: 'lyrics' | 'promo') => {
    onConfirm?.({ videoType, seconds: videoType === 'promo' ? seconds : 0 });
    onOpenChange?.(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => onOpenChange?.(next)}
      variant="sheet"
      title="Choose a video type"
      description="This sets the timeline length, the lyric sync workspace, and whether the promo hook plays.">
      <View className="gap-3 pb-2">
        <View className="rounded-2xl border border-border bg-card p-4">
          <Icon as={Captions} size={20} className="text-primary" />
          <Text className="mt-3 font-heading-bold text-base">Full Lyrics Video</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            Uses the whole track, opens the auto-sync timeline, and leaves the marketing intro off.
          </Text>
          <Button className="mt-4 rounded-full" onPress={() => choose('lyrics')}>
            Start lyrics video
          </Button>
        </View>
        <View className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <Icon as={Clapperboard} size={20} className="text-primary" />
          <Text className="mt-3 font-heading-bold text-base">Short Promo / Teaser Reel</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            A 15s or 30s cut with the audio trimmer, a 3-second intro hook, and an outro button.
          </Text>
          <View className="mt-3 flex-row gap-2">
            {[15, 30].map((value) => (
              <Pressable
                key={value}
                onPress={() => setSeconds(value)}
                className={cn(
                  'h-11 flex-1 items-center justify-center rounded-xl border',
                  seconds === value ? 'border-primary bg-background' : 'border-border bg-background/70'
                )}>
                <Text className={cn('text-sm font-semibold', seconds === value ? 'text-primary' : 'text-foreground')}>{value}s</Text>
              </Pressable>
            ))}
          </View>
          <Button className="mt-4 rounded-full" onPress={() => choose('promo')}>
            {`Start ${seconds}s teaser`}
          </Button>
        </View>
      </View>
    </Dialog>
  );
}
