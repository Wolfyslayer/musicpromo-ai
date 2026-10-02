import { Text, View } from 'react-native';
import { cn } from '@/lib/utils';

export function ProgressBar({
  value = 0,
  className,
  showLabel = false,
}: {
  value?: number;
  className?: string;
  showLabel?: boolean;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <View className="w-full">
      <View className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
        <View className="h-full rounded-full bg-primary" style={{ width: `${v}%` }} />
      </View>
      {showLabel ? <Text className="mt-1 text-right text-xs text-muted-foreground">{v}%</Text> : null}
    </View>
  );
}
