import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const ACCENTS: Record<string, string> = { primary: 'text-primary', accent: 'text-accent', 'chart-3': 'text-chart-3', 'chart-1': 'text-chart-1' };

export default function StatCard({ label, value, icon, accent = 'primary', sub, className }: { label: string; value: React.ReactNode; icon?: LucideIcon; accent?: string; sub?: string; className?: string }) {
  return (
    <View className={cn('rounded-2xl border border-border bg-card p-4', className)}>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</Text>
        {icon ? <Icon as={icon} size={16} className={ACCENTS[accent]} /> : null}
      </View>
      <Text className="mt-2 font-heading-bold text-2xl tracking-tight">{value}</Text>
      {sub ? <Text className="mt-0.5 text-xs text-muted-foreground">{sub}</Text> : null}
    </View>
  );
}
