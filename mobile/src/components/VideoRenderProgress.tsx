import { ActivityIndicator, View } from 'react-native';

import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';

export default function VideoRenderProgress({
  progress = 0,
  message = 'Rendering…',
  title = 'Rendering promo video',
  hint = 'This runs on your device, so keep the app open. It costs nothing.',
}: {
  progress?: number;
  message?: string;
  title?: string;
  hint?: string;
}) {
  const value = Math.max(0, Math.min(100, Number(progress) || 0));

  return (
    <View className="w-full max-w-md items-center gap-4">
      <View className="size-16 items-center justify-center rounded-2xl bg-primary/15">
        <ActivityIndicator size="large" />
      </View>
      <View className="items-center">
        <Text className="text-center font-heading-bold text-lg tracking-tight">{title}</Text>
        <Text className="mt-1 text-center text-sm text-muted-foreground">{message}</Text>
      </View>
      <View className="w-full gap-2 px-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-muted-foreground">Device encode</Text>
          <Text className="text-xs font-medium">{value}%</Text>
        </View>
        <Progress value={value} className="h-2.5" />
      </View>
      {hint ? <Text className="text-center text-xs text-muted-foreground/70">{hint}</Text> : null}
    </View>
  );
}
