import type { LucideIcon } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn('items-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12', className)}>
      {Icon ? (
        <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Icon color="#64748b" size={28} />
        </View>
      ) : null}
      <Text className="text-center text-lg font-semibold text-foreground">{title}</Text>
      {description ? <Text className="mt-2 max-w-sm text-center text-sm text-muted-foreground">{description}</Text> : null}
      {action ? <View className="mt-5">{action}</View> : null}
    </View>
  );
}
