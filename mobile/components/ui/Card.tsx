import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { cn } from '@/lib/utils';

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <View className={cn('rounded-2xl border border-border bg-card p-4', className)}>
      {title ? <Text className="mb-3 text-base font-semibold text-foreground">{title}</Text> : null}
      {children}
    </View>
  );
}
