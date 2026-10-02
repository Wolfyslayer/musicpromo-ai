import * as React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export function Alert({ title, children, variant = 'default', className }: { title?: string; children?: React.ReactNode; variant?: 'default' | 'destructive'; className?: string }) {
  return (
    <View className={cn('rounded-xl border p-3', variant === 'destructive' ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-muted/40', className)}>
      {title ? <Text className={cn('text-sm font-semibold', variant === 'destructive' && 'text-destructive')}>{title}</Text> : null}
      {typeof children === 'string' ? <Text className="mt-0.5 text-sm text-muted-foreground">{children}</Text> : children}
    </View>
  );
}
