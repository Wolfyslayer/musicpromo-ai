import { View } from 'react-native';

import { cn } from '@/lib/utils';

export function Progress({ value = 0, className, indicatorClassName }: { value?: number; className?: string; indicatorClassName?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <View style={{ width: `${pct}%` }} className={cn('h-full rounded-full bg-primary', indicatorClassName)} />
    </View>
  );
}
