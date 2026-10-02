import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export default function ProgressBar({ value = 0, className, showLabel = false }: { value?: number; className?: string; showLabel?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <View className="w-full">
      <View className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
        <LinearGradient colors={['#a164f7', '#f04ca9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${v}%`, height: '100%', borderRadius: 999 }} />
      </View>
      {showLabel ? <Text className="mt-1 text-right text-xs text-muted-foreground">{v}%</Text> : null}
    </View>
  );
}
