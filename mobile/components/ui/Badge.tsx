import { Text, View } from 'react-native';
import { cn } from '@/lib/utils';

const STATUS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  preparing: 'bg-primary/15 text-primary',
  scheduled: 'bg-accent/15 text-accent',
  active: 'bg-green-500/15 text-green-700',
  archived: 'bg-muted text-muted-foreground',
  complete: 'bg-green-500/15 text-green-700',
  ready: 'bg-green-500/15 text-green-700',
};

export function Badge({ label, status }: { label?: string; status?: string }) {
  const key = String(status || label || '').toLowerCase();
  return (
    <View className={cn('self-start rounded-full px-2.5 py-0.5', STATUS[key] || 'bg-muted')}>
      <Text className="text-xs font-medium capitalize">{label || status}</Text>
    </View>
  );
}
