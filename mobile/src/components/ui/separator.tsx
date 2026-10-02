import { View } from 'react-native';

import { cn } from '@/lib/utils';

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return <View className={cn('bg-border', vertical ? 'h-full w-px' : 'h-px w-full', className)} />;
}
