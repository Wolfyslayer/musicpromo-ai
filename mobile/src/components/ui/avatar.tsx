import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export function Avatar({ uri, fallback, className }: { uri?: string | null; fallback?: string; className?: string }) {
  return (
    <View className={cn('size-10 items-center justify-center overflow-hidden rounded-full bg-muted', className)}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Text className="text-sm font-semibold text-muted-foreground">{fallback}</Text>}
    </View>
  );
}
