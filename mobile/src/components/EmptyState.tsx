import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export default function EmptyState({ icon, title, description, action, className }: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <View className={cn('items-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12', className)}>
      {icon ? (
        <View className="mb-4 size-14 items-center justify-center rounded-2xl bg-muted">
          <Icon as={icon} size={28} className="text-muted-foreground" />
        </View>
      ) : null}
      <Text className="text-center font-heading text-lg">{title}</Text>
      {description ? <Text className="mt-1.5 text-center text-sm text-muted-foreground">{description}</Text> : null}
      {action ? <View className="mt-5">{action}</View> : null}
    </View>
  );
}
