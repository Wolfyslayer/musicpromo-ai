import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { statusMeta } from '@/services/constants';
import { cn } from '@/lib/utils';

const COLOR_MAP: Record<string, { box: string; text: string; dot: string }> = {
  muted: { box: 'border-border bg-muted/40', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  primary: { box: 'border-primary/30 bg-primary/15', text: 'text-primary', dot: 'bg-primary' },
  'chart-1': { box: 'border-chart-1/30 bg-chart-1/15', text: 'text-chart-1', dot: 'bg-chart-1' },
  'chart-2': { box: 'border-chart-2/30 bg-chart-2/15', text: 'text-chart-2', dot: 'bg-chart-2' },
  'chart-3': { box: 'border-chart-3/30 bg-chart-3/15', text: 'text-chart-3', dot: 'bg-chart-3' },
};

export default function StatusBadge({ status, className }: { status?: string; className?: string }) {
  const meta = statusMeta(status);
  const c = COLOR_MAP[meta.color] || COLOR_MAP.muted;
  return (
    <View className={cn('flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-0.5', c.box, className)}>
      <View className={cn('size-1.5 rounded-full', c.dot)} />
      <Text className={cn('text-xs font-medium capitalize', c.text)}>{meta.label}</Text>
    </View>
  );
}
