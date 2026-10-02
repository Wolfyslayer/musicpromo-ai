import { Pressable, Text, View } from 'react-native';
import { cn } from '@/lib/utils';

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {tabs.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => onChange(t.id)}
          className={cn(
            'rounded-full px-4 py-2',
            value === t.id ? 'bg-primary' : 'border border-border bg-card',
          )}
        >
          <Text className={cn('text-sm font-medium', value === t.id ? 'text-white' : 'text-foreground')}>
            {t.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
