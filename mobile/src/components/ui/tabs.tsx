import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type TabItem = { value: string; label: string };

/** Segmented / scrollable tab bar; render the active panel yourself. */
export function Tabs({ value, onValueChange, items, scrollable, className }: { value: string; onValueChange: (v: string) => void; items: TabItem[]; scrollable?: boolean; className?: string }) {
  const row = (
    <View className={cn('flex-row rounded-xl bg-muted p-1', className)}>
      {items.map((t) => (
        <Pressable
          key={t.value}
          onPress={() => onValueChange(t.value)}
          className={cn('min-h-9 flex-1 items-center justify-center rounded-lg px-3', scrollable && 'flex-none', value === t.value && 'bg-background')}>
          <Text className={cn('text-sm font-medium', value === t.value ? 'text-foreground' : 'text-muted-foreground')}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
  return scrollable ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {row}
    </ScrollView>
  ) : (
    row
  );
}
