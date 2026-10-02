import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { dismiss, useToast } from '@/components/ui/use-toast';

export function Toaster() {
  const { toasts } = useToast();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, zIndex: 100 }}>
      {toasts.map((t) => (
        <Animated.View key={t.id} entering={FadeInUp} exiting={FadeOutUp} className="mb-2">
          <Pressable
            onPress={() => dismiss(t.id)}
            className={cn(
              'rounded-xl border px-4 py-3 shadow-lg',
              t.variant === 'destructive' ? 'border-destructive bg-destructive' : 'border-border bg-popover'
            )}>
            {t.title ? (
              <Text className={cn('text-sm font-semibold', t.variant === 'destructive' && 'text-destructive-foreground')}>
                {t.title}
              </Text>
            ) : null}
            {t.description ? (
              <Text className={cn('mt-0.5 text-xs', t.variant === 'destructive' ? 'text-destructive-foreground' : 'text-muted-foreground')}>
                {t.description}
              </Text>
            ) : null}
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}
