import { Text, View } from 'react-native';
import { statusMeta } from '@/services/constants';
import { cn } from '@/lib/utils';

const COLOR_MAP: Record<string, string> = {
  muted: 'bg-muted/40 border-border',
  primary: 'bg-primary/15 border-primary/30',
  'chart-1': 'bg-primary/10 border-primary/20',
  'chart-2': 'bg-accent/15 border-accent/30',
  'chart-3': 'bg-green-500/15 border-green-500/30',
};

export function StatusBadge({ status, className }: { status?: string; className?: string }) {
  const meta = statusMeta(status);
  return (
    <View
      className={cn(
        'flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-0.5',
        COLOR_MAP[meta.color] || COLOR_MAP.muted,
        className,
      )}
    >
      <View className="h-1.5 w-1.5 rounded-full bg-foreground" />
      <Text className="text-xs capitalize text-foreground">{meta.label}</Text>
    </View>
  );
}
