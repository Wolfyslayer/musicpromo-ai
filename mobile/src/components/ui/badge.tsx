import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const badgeVariants = cva('flex-row items-center self-start rounded-full border px-2.5 py-0.5', {
  variants: {
    variant: {
      default: 'border-primary/30 bg-primary/15',
      secondary: 'border-border bg-secondary',
      destructive: 'border-destructive/30 bg-destructive/15',
      outline: 'border-border bg-transparent',
    },
  },
  defaultVariants: { variant: 'default' },
});
const badgeText = cva('text-xs font-medium', {
  variants: {
    variant: {
      default: 'text-primary',
      secondary: 'text-secondary-foreground',
      destructive: 'text-destructive',
      outline: 'text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({
  className,
  textClassName,
  variant,
  children,
  ...props
}: React.ComponentProps<typeof View> & VariantProps<typeof badgeVariants> & { textClassName?: string }) {
  return (
    <View className={cn(badgeVariants({ variant }), className)} {...props}>
      {typeof children === 'string' ? <Text className={cn(badgeText({ variant }), textClassName)}>{children}</Text> : children}
    </View>
  );
}
